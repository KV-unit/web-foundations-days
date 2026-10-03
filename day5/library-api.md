# Library API Design — Books Resource

## Endpoints

### List all books
- **Method:** `GET`
- **Path:** `/books`
- **Description:** Retrieves a collection of all books currently in the library. Supports optional pagination (e.g., `?page=1&limit=10`) and sorting (e.g., `?sort=title`).
- **Success status:** `200 OK`

### Get one book
- **Method:** `GET`
- **Path:** `/books/:id`
- **Description:** Retrieves the details of a single, specific book using its unique identifier (`:id`).
- **Success status:** `200 OK`

### Create a book
- **Method:** `POST`
- **Path:** `/books`
- **Description:** Adds a new book to the library. The server will generate and assign a unique ID to the new resource.
- **Example request body:**
```json
  {
    "title": "To Kill a Mockingbird",
    "author": "Harper Lee",
    "isbn": "978-0061120084",
    "publishedYear": 1960,
    "genre": "Fiction"
  }
```
- **Success status:** `201 Created`. Creating a new resource conventionally gets its own distinct 2xx code — it is not `200 OK`, because the primary purpose of the request was to create a new resource, not just to successfully retrieve or process one. The `201 Created` status also typically includes a `Location` header pointing to the URL of the newly created resource.

### Update a book
- **Method:** `PUT`
- **Path:** `/books/:id`
- **Description:** Replaces or updates an existing book's data by its unique ID. The client sends the full updated representation of the book. (Note: you could also use `PATCH` if you wanted to allow partial updates.)
- **Example request body:**
```json
  {
    "title": "To Kill a Mockingbird (50th Anniversary Edition)",
    "author": "Harper Lee",
    "isbn": "978-0061120084",
    "publishedYear": 2010,
    "genre": "Fiction"
  }
```
- **Success status:** `200 OK`

### Delete a book
- **Method:** `DELETE`
- **Path:** `/books/:id`
- **Description:** Removes a specific book from the library database using its unique ID.
- **Success status:** `204 No Content` (the server successfully processed the request, but is not returning any content) or `200 OK` with a success message.

### List books by a given author
- **Method:** `GET`
- **Path:** `/books?author={authorName}`
- **Description:** Filters the main book collection to return only books written by the specified author. This is handled as a query parameter on the root collection endpoint (e.g., `GET /books?author=Harper%20Lee`). Case-insensitive matching is recommended.
- **Success status:** `200 OK`

## Error responses

### 400 Bad Request
- **Example scenario:** A client sends a `POST /books` request, but the JSON body is missing required fields (e.g., no `title` or `author`), or the `publishedYear` is provided as a string (e.g., `"1960"`) instead of a number (`1960`). The server rejects the request and returns this status along with a message explaining the validation failure.
- **Example scenario (author filter):** A client sends a `GET /books?author=` request but provides no value for the author parameter. The server returns `400 Bad Request` because the query parameter is present but malformed/empty.

### 404 Not Found
- **Example scenario:** A client sends a `GET /books/555` request, but no book with the ID `555` exists in the database. Similarly, a client attempts to `DELETE /books/999` or `PUT /books/777` for a book that doesn't exist. The server returns this status to indicate the targeted resource was not found.