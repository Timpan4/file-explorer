# GEMINI.md - Project Context

## Project Overview

This project is a file explorer application built with Tauri, a framework for building desktop applications with web technologies. The backend is written in Rust and the frontend is a single-page application built with Vue.js and TypeScript. The UI is styled with Tailwind CSS and DaisyUI.

The application allows users to browse the file system, starting from the system volumes. Users can navigate through directories and view the files and folders within them.

### Key Technologies:

*   **Backend:** Rust, Tauri
*   **Frontend:** Vue.js, TypeScript, Pinia for state management
*   **Build Tools:** Vite, Bun
*   **Styling:** Tailwind CSS, DaisyUI

### Architecture:

The application follows a typical Tauri architecture. The Rust backend exposes several commands that can be invoked from the frontend. The frontend is a Vue.js application that calls these commands to interact with the file system and display the data to the user.

## Building and Running

### Prerequisites

*   [Rust](https://www.rust-lang.org/)
*   [Node.js](https://nodejs.org/)
*   [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)
*   [Bun](https://bun.sh/)

### Development

To run the application in development mode, use the following command:

```sh
bun tauri dev
```

This will start the Vite development server for the frontend and build and run the Tauri application.

### Building

To build the application for production, use the following command:

```sh
bun tauri build
```

The build artifacts will be located in the `src-tauri/target` directory.

## Development Conventions

### Backend

The Rust backend is located in the `src-tauri` directory. It uses the `sysinfo` crate to get system information like volumes and the standard library's `fs` module to interact with the file system.

Tauri commands are defined in `src-tauri/src/main.rs` and are exposed to the frontend using the `#[tauri::command]` attribute.

### Frontend

The Vue.js frontend is located in the `src` directory. It uses Pinia for state management, with the store defined in `src/stores/store.ts`. The store manages the current directory and its contents.

The application uses `vue-router` for navigation. The routes are defined in `src/router.ts`.

The UI is built with Vue components located in the `src/components` directory. The components are styled with Tailwind CSS and DaisyUI.

## Tauri Best Practices

This is a Tauri project, and as such, it's important to follow Tauri's best practices to ensure the application is secure, performant, and maintainable. Key considerations include:

*   **Security:** Be mindful of the `capabilities` configuration in `tauri.conf.json` to restrict access to system resources. Avoid exposing sensitive APIs or file system locations to the frontend.
*   **Performance:** Use Tauri's asynchronous commands and event system to avoid blocking the main thread. For long-running tasks, consider using background threads or a separate process.
*   **State Management:** For complex applications, consider using a robust state management solution on the frontend and synchronizing it with the backend as needed.
*   **Cross-Platform Compatibility:** Test the application on all target platforms (Windows, macOS, and Linux) to ensure consistent behavior and appearance.
