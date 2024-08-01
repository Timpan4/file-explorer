# Tauri File Explorer

## Overview
This project aims to create a file explorer application using Tauri. The primary goal is to learn Rust and explore desktop development.

**Note:** This project is still in development and is not yet ready for use.

## Table of Contents
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Development](#development)

## Features
- Browse and manage files and directories
- Cross-platform support (Windows, macOS, Linux), To come. Windows support is the primary target first.
- File operations (create, delete, rename, copy, move). To come.
- File previews (image, video, audio, text, PDF, etc.). To come.
- File search. To come.
- File sorting. To come.
- File properties.
- Tabs 
- Home view
- Lightweight and fast

## Installation

### Prerequisites
- [Rust](https://www.rust-lang.org/)
- [Node.js](https://nodejs.org/)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)
- [Bun](https://bun.sh/)

### Clone the repository
```sh
git clone https://github.com/yourusername/tauri-file-explorer.git
cd tauri-file-explorer
```

### Setup
Install dependencies
```sh
bun install
```

Run the development server
```sh
bun tauri dev
```
### Usage
After running the development server, the application will open. You can explore the current directory, navigate through folders, and perform file operations.

Development
Project Structure
```
.
├── src/              # Rust source files
├── src-tauri/        # Tauri configuration and Rust backend
├── public/           # Public assets
├── package.json      # Project configuration and dependencies
└── README.md         # Project documentation
```

### Building the project
```sh
bun tauri build
```
The build artifacts will be located in the src-tauri/target directory.

### Contributing
Contributions are welcome! Please fork the repository and submit a pull request.