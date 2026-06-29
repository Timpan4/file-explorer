use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};
use file_explorer_core::directory::{
    DirectoryItemKind, DirectoryItemStub, NativeIconState, SortDirection, SortField, SortSpec,
};
use file_explorer_core::projection::project_directory_snapshot;
use std::hint::black_box;

/// Builds a deterministic, representative directory listing mixing files,
/// directories, symlinks and other entries, the way a real folder snapshot
/// arrives before it is filtered and sorted for display.
fn build_items(count: usize) -> Vec<DirectoryItemStub> {
    (0..count)
        .map(|index| {
            let kind = match index % 4 {
                0 => DirectoryItemKind::Directory,
                1 => DirectoryItemKind::File,
                2 => DirectoryItemKind::Symlink,
                _ => DirectoryItemKind::Other,
            };
            let name = format!("Item-{:05}-{}.txt", (count - index), index % 97);
            let path = format!(r"C:\Users\dev\Projects\workspace\{}\{}", index % 32, name);

            DirectoryItemStub {
                id: path.clone(),
                name,
                path,
                kind,
                size: Some(((index * 7919) % 5_000_000) as u64),
                modified_at: Some(format!(
                    "2024-{:02}-{:02}T12:00:00Z",
                    (index % 12) + 1,
                    (index % 28) + 1
                )),
                hidden: index % 13 == 0,
                readonly: index % 17 == 0,
                icon_data_url: None,
                native_icon_state: NativeIconState::Pending,
            }
        })
        .collect()
}

fn bench_projection(c: &mut Criterion) {
    let mut group = c.benchmark_group("project_directory_snapshot");

    for size in [100usize, 1_000, 10_000] {
        let items = build_items(size);

        // Default projection: no query, default (Type asc) sort.
        group.bench_with_input(
            BenchmarkId::new("default_sort", size),
            &items,
            |b, items| {
                b.iter(|| {
                    project_directory_snapshot(black_box(items), black_box(None), black_box(None))
                });
            },
        );

        // Filtered projection: a query that matches a subset of entries.
        group.bench_with_input(BenchmarkId::new("filtered", size), &items, |b, items| {
            b.iter(|| {
                project_directory_snapshot(
                    black_box(items),
                    black_box(Some("item-1")),
                    black_box(None),
                )
            });
        });

        // Sort by name descending: exercises the case-insensitive name comparator.
        let sort_by_name = SortSpec {
            field: SortField::Name,
            direction: SortDirection::Desc,
        };
        group.bench_with_input(
            BenchmarkId::new("sort_by_name_desc", size),
            &items,
            |b, items| {
                b.iter(|| {
                    project_directory_snapshot(
                        black_box(items),
                        black_box(None),
                        black_box(Some(sort_by_name.clone())),
                    )
                });
            },
        );

        // Sort by size ascending: exercises the numeric comparator with name tiebreaker.
        let sort_by_size = SortSpec {
            field: SortField::Size,
            direction: SortDirection::Asc,
        };
        group.bench_with_input(
            BenchmarkId::new("sort_by_size_asc", size),
            &items,
            |b, items| {
                b.iter(|| {
                    project_directory_snapshot(
                        black_box(items),
                        black_box(None),
                        black_box(Some(sort_by_size.clone())),
                    )
                });
            },
        );
    }

    group.finish();
}

criterion_group!(benches, bench_projection);
criterion_main!(benches);
