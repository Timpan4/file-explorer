use crate::directory::{DirectoryItemKind, DirectoryItemStub, SortDirection, SortField, SortSpec};
use std::cmp::Ordering;

pub fn project_directory_snapshot(
    items: &[DirectoryItemStub],
    query: Option<&str>,
    sort: Option<SortSpec>,
) -> Vec<DirectoryItemStub> {
    let normalized_query = normalize_query(query);
    let mut projected_items = items
        .iter()
        .filter(|item| matches_query(item, normalized_query.as_deref()))
        .cloned()
        .collect::<Vec<_>>();

    sort_directory_items(&mut projected_items, &sort.unwrap_or(default_sort_spec()));
    projected_items
}

fn normalize_query(query: Option<&str>) -> Option<String> {
    let trimmed_query = query.unwrap_or_default().trim();
    if trimmed_query.is_empty() {
        return None;
    }

    Some(trimmed_query.to_ascii_lowercase())
}

fn matches_query(item: &DirectoryItemStub, normalized_query: Option<&str>) -> bool {
    let Some(normalized_query) = normalized_query else {
        return true;
    };

    format!(
        "{} {} {}",
        item.name,
        searchable_kind_label(&item.kind),
        item.path
    )
    .to_ascii_lowercase()
    .contains(normalized_query)
}

fn sort_directory_items(items: &mut [DirectoryItemStub], sort_spec: &SortSpec) {
    items.sort_by(|left, right| compare_directory_items(left, right, sort_spec));
}

fn compare_directory_items(
    left: &DirectoryItemStub,
    right: &DirectoryItemStub,
    sort_spec: &SortSpec,
) -> Ordering {
    let left_is_folder_group = matches!(
        left.kind,
        DirectoryItemKind::Directory | DirectoryItemKind::Symlink
    );
    let right_is_folder_group = matches!(
        right.kind,
        DirectoryItemKind::Directory | DirectoryItemKind::Symlink
    );

    let directory_bias = match (left_is_folder_group, right_is_folder_group) {
        (true, false) => Ordering::Less,
        (false, true) => Ordering::Greater,
        _ => Ordering::Equal,
    };

    if directory_bias != Ordering::Equal {
        return directory_bias;
    }

    let ordering = match sort_spec.field {
        SortField::Name => left
            .name
            .to_ascii_lowercase()
            .cmp(&right.name.to_ascii_lowercase()),
        SortField::Type => type_label(&left.kind).cmp(type_label(&right.kind)),
        SortField::ModifiedAt => left.modified_at.cmp(&right.modified_at),
        SortField::Size => left.size.cmp(&right.size),
    };

    let ordering = if ordering == Ordering::Equal {
        left.name
            .to_ascii_lowercase()
            .cmp(&right.name.to_ascii_lowercase())
    } else {
        ordering
    };

    match sort_spec.direction {
        SortDirection::Asc => ordering,
        SortDirection::Desc => ordering.reverse(),
    }
}

fn default_sort_spec() -> SortSpec {
    SortSpec {
        field: SortField::Type,
        direction: SortDirection::Asc,
    }
}

fn searchable_kind_label(kind: &DirectoryItemKind) -> &'static str {
    match kind {
        DirectoryItemKind::Directory => "directory",
        DirectoryItemKind::File => "file",
        DirectoryItemKind::Symlink => "symlink",
        DirectoryItemKind::Other => "other",
    }
}

fn type_label(kind: &DirectoryItemKind) -> &'static str {
    match kind {
        DirectoryItemKind::Directory => "Folder",
        DirectoryItemKind::File => "File",
        DirectoryItemKind::Symlink => "Shortcut",
        DirectoryItemKind::Other => "Other",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::directory::NativeIconState;

    fn item(name: &str, path: &str, kind: DirectoryItemKind) -> DirectoryItemStub {
        DirectoryItemStub {
            id: path.to_string(),
            name: name.to_string(),
            path: path.to_string(),
            kind,
            size: None,
            modified_at: None,
            hidden: false,
            readonly: false,
            icon_data_url: None,
            native_icon_state: NativeIconState::Pending,
        }
    }

    #[test]
    fn project_directory_snapshot_filters_without_mutating_source_items() {
        let items = vec![
            item("Alpha", r"C:\\Work\\Alpha.txt", DirectoryItemKind::File),
            item("Beta", r"C:\\Work\\Beta", DirectoryItemKind::Directory),
        ];

        let projected = project_directory_snapshot(&items, Some("beta"), None);

        assert_eq!(projected, vec![items[1].clone()]);
        assert_eq!(items.len(), 2);
    }

    #[test]
    fn project_directory_snapshot_keeps_directories_grouped_when_sorting_by_name_desc() {
        let items = vec![
            item("alpha.txt", r"C:\\Work\\alpha.txt", DirectoryItemKind::File),
            item("Zoo", r"C:\\Work\\Zoo", DirectoryItemKind::Directory),
            item("Beta", r"C:\\Work\\Beta", DirectoryItemKind::Directory),
        ];

        let projected = project_directory_snapshot(
            &items,
            None,
            Some(SortSpec {
                field: SortField::Name,
                direction: SortDirection::Desc,
            }),
        );

        assert_eq!(projected[0].name, "Zoo");
        assert_eq!(projected[1].name, "Beta");
        assert_eq!(projected[2].name, "alpha.txt");
    }
}
