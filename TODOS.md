# TODOs for Tauri File Explorer

This file outlines the recommended to-do items for the Tauri File Explorer project. These are based on the initial project analysis and the features listed in the `README.md`.

## High Priority

*   [ ] **Implement File Operations:**
    *   [ ] Create: Implement the ability to create new files and folders.
    *   [ ] Delete: Implement the ability to delete files and folders.
    *   [ ] Rename: Implement the ability to rename files and folders.
    *   [ ] Copy: Implement the ability to copy files and folders.
    *   [ ] Move: Implement the ability to move files and folders.
*   [ ] **Implement File Previews:**
    *   [ ] Text: Display the content of text files.
    *   [ ] Images: Display previews of common image formats (PNG, JPG, GIF, etc.).
    *   [ ] PDF: Embed a PDF viewer to display PDF files.
*   [ ] **Implement File Search:**
    *   [ ] Add a search bar to the UI.
    *   [ ] Implement a backend command to search for files and folders.
*   [ ] **Implement Directory Navigation:**
    *   [ ] Allow clicking on a directory to navigate into it.
    *   [ ] Implement "Up" or "Back" navigation to go to the parent directory.
*   [ ] **Implement File Interaction:**
    *   [ ] Add the ability to open files with their default application.
*   [ ] **Migrate Frontend to Svelte:**
    *   [ ] Replace the Vue.js frontend with a new implementation using Svelte.

## Medium Priority

*   [ ] **Implement File Sorting:**
    *   [ ] Add UI controls to sort by name, size, and last modified date.
    *   [ ] Implement the sorting logic in the frontend.
*   [ ] **Implement File Properties:**
    *   [ ] Create a component to display file properties (size, creation date, etc.).
    *   [ ] Add a backend command to get detailed file metadata.
*   [ ] **Implement Tabs:**
    *   [ ] Add a tab bar to the UI.
    *   [ ] Allow users to open multiple directories in different tabs.
*   [ ] **Implement Breadcrumbs:**
    *   [ ] Add a breadcrumb trail to show the current directory path.

## Low Priority

*   [ ] **Implement a Home View:**
    *   [ ] Design and implement a home view with quick access to common locations.
*   [ ] **Cross-platform Support:**
    *   [ ] Test and ensure the application works on macOS and Linux.
    *   [ ] Address any platform-specific issues.
*   [ ] **Improve Disk Space Calculation:**
    *   [ ] Use binary-based calculation (GiB) for disk space instead of decimal-based (GB).

## Future Enhancements

*   [ ] **Context Menus:** Implement right-click context menus for files and folders.
*   [ ] **Drag and Drop:** Implement drag and drop for file operations.
*   [ ] **Keyboard Shortcuts:** Add keyboard shortcuts for common actions.
*   [ ] **Settings:** Create a settings page to configure the application.
*   [ ] **Theming:** Add support for different themes (light, dark, etc.).
*   [ ] **Improve Logging:**
    *   [ ] Replace `println!` with a dedicated logging library in the backend.

## Known Issues

*   [x] **State Persistence on Refresh**: The application state is not saved and restored on page refresh. When the user presses F5, the application resets to a blank screen. The current directory path should be persisted, either in the URL or in `localStorage`, to restore the state properly.
*   [ ] **URL Doesn't Reflect Current Directory**: The URL does not update to reflect the current directory path. This prevents bookmarking and direct navigation to specific directories. The router should be updated to include the current path (e.g., `/files/C:/Users/`).
*   [ ] **Missing Error Handling**: There is no error handling for the `invoke` calls to the backend. If an error occurs when reading a directory (e.g., permission denied), the application does not display a user-friendly error message.
*   [ ] **State Inconsistency**: The `currentDirectory` in the Pinia store is not updated when the `getDirectory` function is called. This can lead to a mismatch between the displayed directory content and the actual current directory path in the state.
*   [ ] **Robust Error Handling in Rust:** The backend uses `.unwrap()` which can crash the application. Replace it with proper error handling.
*   [ ] **Error Propagation to Frontend:** The backend should send specific error messages to the frontend instead of returning empty lists.
