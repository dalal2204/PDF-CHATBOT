# Papertrail — PDF document assistant

Papertrail is a document Q&A application built around the existing Gemini and Qdrant stack. PDFs are uploaded once, indexed for retrieval, and then available for repeated document-specific conversations.

## Features

- Upload and manage multiple PDFs.
- Store PDF files in Cloudinary and document metadata in MongoDB.
- Extract and overlap-chunk PDF text, embed it with Gemini, and store vectors in Qdrant.
- Filter vector retrieval by the selected MongoDB document ID.
- Persist chat exchanges and display the selected document's history after refresh.
- Delete a document together with its vectors, PDF, and conversation history.
- Responsive React interface using Tailwind CSS v4.3.

## Stack and architecture

```text
React + Vite + Tailwind
        │ /api
        ▼
Express routes → controllers → document / chat services → BullMQ worker
        ├── Redis (document-ingestion jobs)
        ├── MongoDB (documents, conversations)
        ├── Cloudinary (PDF files)
        ├── Gemini (text embeddings and answer generation)
        └── Qdrant (document-filtered chunk vectors)
```

```text
backend/
  config/         MongoDB, Cloudinary, Gemini, Qdrant clients
  controllers/    HTTP request handlers
  middlewares/    in-memory PDF upload and error handling
  models/         Document and Chat schemas
  routes/         Health, document, and document-chat endpoints
  services/       PDF, embedding, AI, vector, cloud storage, lifecycle
  utils/          chunking, async handler, API errors
  index.js
frontend/
  src/services/   API client
  src/App.jsx     document library and chat UI
  src/index.css   Tailwind and responsive styles
```

## RAG workflow

1. The API validates a PDF (20 MB limit), streams it from memory to Cloudinary, and creates a `processing` record in MongoDB.
2. The API enqueues the document ID and returns HTTP 202. The separate worker downloads the PDF from Cloudinary.
3. `pdf-parse` extracts text; text is split into chunks with overlap.
4. Gemini generates a vector for each chunk. Qdrant stores the vector with `documentId`, `chunkIndex`, and chunk text in its payload.
5. MongoDB marks the document `ready`.
6. A chat question is embedded and Qdrant searches with a mandatory `documentId` filter.
7. Gemini answers using the retrieved excerpts, and the question, answer, and source excerpts are saved to MongoDB.

The existing `pdf-docs` collection is reused by default and checked for the configured vector size. The worker creates it lazily when needed. Embeddings are not regenerated for chat requests. Ingestion retries three times with exponential backoff; each attempt clears partial vectors first, and deterministic point IDs make chunk upserts idempotent.

## API

All endpoints are prefixed with `/api`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | API and MongoDB status |
| POST | `/documents` | Upload a PDF (`multipart/form-data`, field `pdf`) |
| GET | `/documents` | List documents |
| GET | `/documents/:id` | Get document metadata |
| DELETE | `/documents/:id` | Delete document and associated resources |
| POST | `/documents/:documentId/chat` | Ask a question (`{ "question": "..." }`) |
| GET | `/documents/:documentId/chat` | List chat history |
| DELETE | `/documents/:documentId/chat` | Clear chat history |

Responses use `{ "success": true, "data": ... }`; errors use `{ "success": false, "message": ... }`.

## Configure external services

Copy `backend/.env.example` to `backend/.env` and provide:

- **MongoDB:** `MONGO_URI` for a database reachable from this machine.
- **Gemini:** `GEMINI_API_KEY`; the model names can be changed using `GEMINI_EMBEDDING_MODEL` and `GEMINI_CHAT_MODEL`.
- **Qdrant:** `QDRANT_URL`, `QDRANT_API_KEY`, and the embedding vector size. Collection defaults to `pdf-docs`; collection and size are controlled by `QDRANT_COLLECTION` and `QDRANT_VECTOR_SIZE`.
- **Cloudinary:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
- **Redis:** `REDIS_URL` (defaults in the example to `redis://127.0.0.1:6379`).
- **Worker concurrency:** `INGESTION_CONCURRENCY` controls simultaneous ingestion jobs per worker process and defaults to `2`. Set it to any positive integer to tune parallel PDF processing; use lower values when provider capacity or worker memory is limited. If running multiple worker processes, their concurrency values add together.
- **CORS:** `CLIENT_ORIGIN` is a comma-separated list of frontend origins.

The embedding vector size must match the selected Gemini embedding model's output. The default is 3072 to preserve the existing project's Qdrant configuration. For a fresh or reused collection with another size, set `QDRANT_VECTOR_SIZE` to the model's actual dimension and use a matching collection.

Copy `frontend/.env.example` to `frontend/.env` only if the API URL differs from `http://localhost:3000/api`. Frontend variables must be public configuration only. Never place server API credentials in the frontend environment.

## Run locally

Start Redis locally, for example with Docker Desktop:

```powershell
docker run --rm --name docmind-redis -p 6379:6379 redis:7-alpine
```

Install dependencies in each project directory. Start the API, worker, and UI in separate terminals:

```powershell
cd backend
npm.cmd install
npm.cmd run dev
```

```powershell
cd backend
npm.cmd run worker:dev
```

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open the Vite URL printed in the frontend terminal. For a production frontend build, run `npm.cmd run build` in `frontend`.

## Example workflow

1. Configure MongoDB, Gemini, Qdrant, Cloudinary, and Redis in `backend/.env`.
2. Start Redis, the API, the worker, and the frontend. Upload a text-based PDF from the document library.
3. The document appears as `processing`; the frontend polls the existing document list and enables chat after it becomes `ready`.
4. Select the ready document, ask questions, and revisit the conversation after refresh.
5. Delete the document from its library menu to remove its stored file, chunks, metadata, and chats.

### Verify ingestion locally

Upload a real text based PDF while Redis, the API, and worker are running. The response should be HTTP 202 with `data._id` and `data.status: "processing"`:

```powershell
curl.exe -F "pdf=@C:\path\to\document.pdf;type=application/pdf" http://localhost:3000/api/documents
curl.exe http://localhost:3000/api/documents/DOCUMENT_ID
```

Repeat the GET request until `status` is `ready`; the frontend also refreshes this state automatically. Chat controls appear only when ready.

To exercise failure and retry handling, create a `.pdf` file whose first five bytes are `%PDF-` but whose remaining contents are invalid PDF data, upload it the same way, and poll its document ID. After three worker attempts with exponential backoff, the record should show `status: "failed"` and a safe `processingError`. This tests the worker path without changing the chat or document APIs.

## Design notes

- The backend uses memory-backed Multer uploads, so PDFs are not retained on local disk.
- Qdrant points use UUIDs to avoid collisions between documents.
- Document operations are currently unauthenticated and intended for a single-user/personal deployment. Add authentication and ownership checks before exposing this API to multiple users.
- Scanned/image-only PDFs are rejected with a clear message; OCR is not included.
- Exhausted processing failures keep a `failed` document record with a user-safe error and attempt to clear partial vectors. The uploaded PDF remains associated with the failed record so deleting it can clean up Cloudinary.
- Deletion attempts cleanup across Cloudinary, Qdrant, and chat history before removing the MongoDB document. If a remote cleanup fails, the document record remains so cleanup can be retried.
- The architecture takes inspiration from StudyForge's separation of document processing, chat, and persistence responsibilities while retaining this project's Gemini and Qdrant stack.
