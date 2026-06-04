use super::*;
use file_explorer_core::file_operations::FileOperationKind;
use std::path::PathBuf;

fn temp_case(name: &str) -> PathBuf {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("system time")
        .as_nanos();
    let path = std::env::temp_dir().join(format!(
        "file-explorer-{name}-{}-{timestamp}",
        std::process::id()
    ));
    let _ = fs::remove_dir_all(&path);
    path
}

#[test]
fn keep_both_path_preserves_file_extension() {
    let path = keep_both_path(Path::new(r"C:\Temp\report.txt"), 2);

    assert_eq!(path.to_string_lossy(), r"C:\Temp\report - Copy (2).txt");
}

#[test]
fn conflict_skip_reports_skipped_item() {
    let temp_dir = temp_case("skip-test");
    let source_dir = temp_dir.join("source");
    let destination_dir = temp_dir.join("destination");
    fs::create_dir_all(&source_dir).expect("source dir");
    fs::create_dir_all(&destination_dir).expect("destination dir");
    fs::write(source_dir.join("report.txt"), "from source").expect("source file");
    fs::write(destination_dir.join("report.txt"), "existing").expect("destination file");

    let request = StartFileOperationRequest {
        operation_id: "operation-1".to_string(),
        kind: FileOperationKind::Copy,
        source_paths: vec![source_dir.join("report.txt").to_string_lossy().to_string()],
        destination_directory: destination_dir.to_string_lossy().to_string(),
        default_conflict_resolution: Some(FileConflictResolution::Skip),
    };

    let execution =
        execute_file_operation(&request, || false, |_| None, |_| {}).expect("operation should run");
    let report = match execution {
        FileOperationExecution::Completed(report) => report,
        FileOperationExecution::Cancelled(_) => panic!("operation should not cancel"),
    };

    assert!(report.completed.is_empty());
    assert_eq!(report.skipped.len(), 1);
    assert_eq!(
        fs::read_to_string(destination_dir.join("report.txt")).expect("destination contents"),
        "existing"
    );

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn conflict_keep_both_copies_to_unique_name() {
    let temp_dir = temp_case("keep-both-test");
    let source_dir = temp_dir.join("source");
    let destination_dir = temp_dir.join("destination");
    fs::create_dir_all(&source_dir).expect("source dir");
    fs::create_dir_all(&destination_dir).expect("destination dir");
    fs::write(source_dir.join("report.txt"), "from source").expect("source file");
    fs::write(destination_dir.join("report.txt"), "existing").expect("destination file");

    let request = StartFileOperationRequest {
        operation_id: "operation-1".to_string(),
        kind: FileOperationKind::Copy,
        source_paths: vec![source_dir.join("report.txt").to_string_lossy().to_string()],
        destination_directory: destination_dir.to_string_lossy().to_string(),
        default_conflict_resolution: Some(FileConflictResolution::KeepBoth),
    };

    let execution =
        execute_file_operation(&request, || false, |_| None, |_| {}).expect("operation should run");
    let report = match execution {
        FileOperationExecution::Completed(report) => report,
        FileOperationExecution::Cancelled(_) => panic!("operation should not cancel"),
    };

    assert_eq!(report.completed.len(), 1);
    assert_eq!(
        fs::read_to_string(destination_dir.join("report - Copy.txt")).expect("copy contents"),
        "from source"
    );

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn conflict_replace_overwrites_existing_file() {
    let temp_dir = temp_case("replace-test");
    let source_dir = temp_dir.join("source");
    let destination_dir = temp_dir.join("destination");
    fs::create_dir_all(&source_dir).expect("source dir");
    fs::create_dir_all(&destination_dir).expect("destination dir");
    fs::write(source_dir.join("report.txt"), "from source").expect("source file");
    fs::write(destination_dir.join("report.txt"), "existing").expect("destination file");

    let request = StartFileOperationRequest {
        operation_id: "operation-1".to_string(),
        kind: FileOperationKind::Copy,
        source_paths: vec![source_dir.join("report.txt").to_string_lossy().to_string()],
        destination_directory: destination_dir.to_string_lossy().to_string(),
        default_conflict_resolution: Some(FileConflictResolution::Replace),
    };

    let execution =
        execute_file_operation(&request, || false, |_| None, |_| {}).expect("operation should run");
    let report = match execution {
        FileOperationExecution::Completed(report) => report,
        FileOperationExecution::Cancelled(_) => panic!("operation should not cancel"),
    };

    assert_eq!(report.completed.len(), 1);
    assert!(report.skipped.is_empty());
    assert!(report.failed.is_empty());
    assert_eq!(
        fs::read_to_string(destination_dir.join("report.txt")).expect("destination contents"),
        "from source"
    );

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn copy_to_same_path_with_replace_skips_without_deleting_source() {
    let temp_dir = temp_case("replace-self-copy-test");
    let source_dir = temp_dir.join("source");
    fs::create_dir_all(&source_dir).expect("source dir");
    fs::write(source_dir.join("report.txt"), "source").expect("source file");
    let mut progress = Vec::new();

    let request = StartFileOperationRequest {
        operation_id: "operation-1".to_string(),
        kind: FileOperationKind::Copy,
        source_paths: vec![source_dir.join("report.txt").to_string_lossy().to_string()],
        destination_directory: source_dir.to_string_lossy().to_string(),
        default_conflict_resolution: Some(FileConflictResolution::Replace),
    };

    let execution =
        execute_file_operation(&request, || false, |_| None, |event| progress.push(event))
            .expect("operation should run");
    let report = match execution {
        FileOperationExecution::Completed(report) => report,
        FileOperationExecution::Cancelled(_) => panic!("operation should not cancel"),
    };

    assert!(report.completed.is_empty());
    assert_eq!(report.skipped.len(), 1);
    assert!(report.failed.is_empty());
    assert_eq!(progress.len(), 1);
    assert_eq!(
        fs::read_to_string(source_dir.join("report.txt")).expect("source contents"),
        "source"
    );

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn ask_conflict_uses_resolver_before_copying() {
    let temp_dir = temp_case("ask-conflict-test");
    let source_dir = temp_dir.join("source");
    let destination_dir = temp_dir.join("destination");
    fs::create_dir_all(&source_dir).expect("source dir");
    fs::create_dir_all(&destination_dir).expect("destination dir");
    fs::write(source_dir.join("report.txt"), "from source").expect("source file");
    fs::write(destination_dir.join("report.txt"), "existing").expect("destination file");
    let mut conflicts = Vec::new();

    let request = StartFileOperationRequest {
        operation_id: "operation-1".to_string(),
        kind: FileOperationKind::Copy,
        source_paths: vec![source_dir.join("report.txt").to_string_lossy().to_string()],
        destination_directory: destination_dir.to_string_lossy().to_string(),
        default_conflict_resolution: Some(FileConflictResolution::Ask),
    };

    let execution = execute_file_operation(
        &request,
        || false,
        |conflict| {
            conflicts.push(conflict);
            Some(FileConflictResolution::KeepBoth)
        },
        |_| {},
    )
    .expect("operation should run");
    let report = match execution {
        FileOperationExecution::Completed(report) => report,
        FileOperationExecution::Cancelled(_) => panic!("operation should not cancel"),
    };

    assert_eq!(conflicts.len(), 1);
    assert_eq!(conflicts[0].name, "report.txt");
    assert_eq!(report.completed.len(), 1);
    assert_eq!(
        fs::read_to_string(destination_dir.join("report - Copy.txt")).expect("copy contents"),
        "from source"
    );

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn move_to_same_directory_skips_source_without_deleting_it() {
    let temp_dir = temp_case("move-same-directory-test");
    let source_dir = temp_dir.join("source");
    fs::create_dir_all(&source_dir).expect("source dir");
    fs::write(source_dir.join("report.txt"), "source").expect("source file");
    let mut progress = Vec::new();

    let request = StartFileOperationRequest {
        operation_id: "operation-1".to_string(),
        kind: FileOperationKind::Move,
        source_paths: vec![source_dir.join("report.txt").to_string_lossy().to_string()],
        destination_directory: source_dir.to_string_lossy().to_string(),
        default_conflict_resolution: Some(FileConflictResolution::KeepBoth),
    };

    let execution =
        execute_file_operation(&request, || false, |_| None, |event| progress.push(event))
            .expect("operation should run");
    let report = match execution {
        FileOperationExecution::Completed(report) => report,
        FileOperationExecution::Cancelled(_) => panic!("operation should not cancel"),
    };

    assert!(report.completed.is_empty());
    assert_eq!(report.skipped.len(), 1);
    assert!(report.failed.is_empty());
    assert_eq!(progress.len(), 1);
    assert_eq!(
        fs::read_to_string(source_dir.join("report.txt")).expect("source contents"),
        "source"
    );

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn cancellation_before_first_item_does_not_touch_files() {
    let temp_dir = temp_case("cancel-before-first-test");
    let source_dir = temp_dir.join("source");
    let destination_dir = temp_dir.join("destination");
    fs::create_dir_all(&source_dir).expect("source dir");
    fs::create_dir_all(&destination_dir).expect("destination dir");
    fs::write(source_dir.join("report.txt"), "source").expect("source file");
    let mut progress = Vec::new();

    let request = StartFileOperationRequest {
        operation_id: "operation-1".to_string(),
        kind: FileOperationKind::Copy,
        source_paths: vec![source_dir.join("report.txt").to_string_lossy().to_string()],
        destination_directory: destination_dir.to_string_lossy().to_string(),
        default_conflict_resolution: Some(FileConflictResolution::KeepBoth),
    };

    let execution =
        execute_file_operation(&request, || true, |_| None, |event| progress.push(event))
            .expect("operation should cancel cleanly");
    let report = match execution {
        FileOperationExecution::Completed(_) => panic!("operation should cancel"),
        FileOperationExecution::Cancelled(report) => report,
    };

    assert!(report.completed.is_empty());
    assert!(report.skipped.is_empty());
    assert!(report.failed.is_empty());
    assert!(progress.is_empty());
    assert!(source_dir.join("report.txt").exists());
    assert!(!destination_dir.join("report.txt").exists());

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn copy_directory_into_own_descendant_reports_failure_without_copying() {
    let temp_dir = temp_case("copy-into-descendant-test");
    let source_dir = temp_dir.join("source");
    let child_destination = source_dir.join("child");
    fs::create_dir_all(&child_destination).expect("child destination dir");
    fs::write(source_dir.join("report.txt"), "source").expect("source file");

    let request = StartFileOperationRequest {
        operation_id: "operation-1".to_string(),
        kind: FileOperationKind::Copy,
        source_paths: vec![source_dir.to_string_lossy().to_string()],
        destination_directory: child_destination.to_string_lossy().to_string(),
        default_conflict_resolution: Some(FileConflictResolution::KeepBoth),
    };

    let execution =
        execute_file_operation(&request, || false, |_| None, |_| {}).expect("operation should run");
    let report = match execution {
        FileOperationExecution::Completed(report) => report,
        FileOperationExecution::Cancelled(_) => panic!("operation should not cancel"),
    };

    assert!(report.completed.is_empty());
    assert!(report.skipped.is_empty());
    assert_eq!(report.failed.len(), 1);
    assert_eq!(
        report.failed[0].code,
        "file_operation_destination_inside_source"
    );
    assert!(!child_destination.join("source").exists());

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn recursive_directory_copy_checks_cancellation_between_entries() {
    let temp_dir = temp_case("recursive-cancel-test");
    let source_dir = temp_dir.join("source");
    let destination_dir = temp_dir.join("destination");
    fs::create_dir_all(&source_dir).expect("source dir");
    fs::create_dir_all(&destination_dir).expect("destination dir");
    fs::write(source_dir.join("report.txt"), "source").expect("source file");
    let mut cancel_checks = 0;

    let request = StartFileOperationRequest {
        operation_id: "operation-1".to_string(),
        kind: FileOperationKind::Copy,
        source_paths: vec![source_dir.to_string_lossy().to_string()],
        destination_directory: destination_dir.to_string_lossy().to_string(),
        default_conflict_resolution: Some(FileConflictResolution::KeepBoth),
    };

    let execution = execute_file_operation(
        &request,
        || {
            cancel_checks += 1;
            cancel_checks >= 3
        },
        |_| None,
        |_| {},
    )
    .expect("operation should cancel cleanly");
    let report = match execution {
        FileOperationExecution::Completed(_) => panic!("operation should cancel"),
        FileOperationExecution::Cancelled(report) => report,
    };

    assert!(report.completed.is_empty());
    assert!(report.failed.is_empty());
    assert!(destination_dir.join("source").exists());
    assert!(!destination_dir.join("source").join("report.txt").exists());

    let _ = fs::remove_dir_all(&temp_dir);
}
