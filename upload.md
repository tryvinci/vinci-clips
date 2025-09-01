# Storing and Processing Media Files in a Client-Side Video Editor

This document outlines the architecture for handling media files (video, audio, images) in a client-side video editing application. The approach is designed to be efficient and scalable, relying on browser technologies like IndexedDB and state management libraries like Redux.

## Core Concepts

The fundamental idea is to separate the storage of large media files from the application's state.

1.  **Client-Side Storage (IndexedDB)**: Large media files are stored directly in the user's browser using IndexedDB. This avoids the need to upload files to a server, reducing latency and server costs. Each file is stored with a unique identifier.

2.  **State Management (Redux)**: The application's state, managed by Redux, only stores metadata about the media files, not the files themselves. This metadata includes the unique ID of each file, its properties (like start time, end time, position on the timeline), and any transformations applied to it.

## Workflow

Here's a step-by-step breakdown of the process:

### 1. File Upload

-   **Component**: `UploadMedia.tsx`
-   **Action**: The user selects one or more media files through a file input element.
-   **Process**:
    1.  The `handleFileChange` function is triggered.
    2.  For each file, a unique ID is generated using `crypto.randomUUID()`.
    3.  The file is stored in IndexedDB using a `storeFile(file, fileId)` function.
    4.  The unique ID (`fileId`) is dispatched to the Redux store and added to an array of file IDs.

### 2. Displaying Media

-   **Component**: `MediaList.tsx`
-   **Action**: The component displays a list of all uploaded media files.
-   **Process**:
    1.  The component retrieves the array of `fileId`s from the Redux store.
    2.  It iterates through the IDs and fetches the corresponding file from IndexedDB using a `getFile(fileId)` function.
    3.  The list of files is then rendered for the user.

### 3. Adding Media to the Timeline

-   **Component**: `AddMedia.tsx`
-   **Action**: The user clicks an "Add" button next to a media file in the list.
-   **Process**:
    1.  The `handleFileChange` function is triggered, passing the `fileId`.
    2.  The file is retrieved from IndexedDB using `getFile(fileId)`.
    3.  A new media object is created with default properties for the timeline (e.g., `startTime`, `endTime`, `positionStart`, `positionEnd`, `type`). The file type is determined by a utility function like `categorizeFile()`.
    4.  This new media object is dispatched to the Redux store and added to the `mediaFiles` array, which represents the timeline.

## Implementation Guide for an LLM

To replicate this architecture in a different application, follow these steps:

1.  **Set up IndexedDB**:
    -   Use a library like `idb` for a more straightforward API.
    -   Create a database and an object store for the media files. The key for the object store should be the unique file ID.

2.  **Implement `storeFile` and `getFile`**:
    -   `storeFile(file, fileId)`: This function should take a `File` object and a unique ID, and save the file to the IndexedDB object store.
    -   `getFile(fileId)`: This function should take a file ID and retrieve the corresponding `File` object from IndexedDB.

3.  **Set up Redux Store**:
    -   Create a slice for your project state (e.g., `projectSlice`).
    -   In this slice, manage two key pieces of state:
        -   `filesID`: An array of strings, where each string is a unique ID for a stored file.
        -   `mediaFiles`: An array of objects, where each object represents a media file on the timeline and contains its metadata.

4.  **Create the UI Components**:
    -   **`UploadMedia.tsx`**: A component with a file input (`<input type="file">`). On file selection, it should call `storeFile` and dispatch an action to add the new `fileId` to the `filesID` array in the Redux store.
    -   **`MediaList.tsx`**: A component that gets the `filesID` array from the Redux store, uses `getFile` to retrieve the files from IndexedDB, and displays them.
    -   **`AddMedia.tsx`**: A component that, when triggered, gets the `fileId`, creates a metadata object for the timeline, and dispatches an action to add this object to the `mediaFiles` array in the Redux store.

By following this pattern, you can build a robust client-side video editor that handles large media files efficiently without relying on a server for storage.