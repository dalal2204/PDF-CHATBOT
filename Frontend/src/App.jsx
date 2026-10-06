import { useRef, useState } from 'react'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

function Icon({ name, className = 'h-5 w-5' }) {
  const common = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  if (name === 'file') return <svg {...common}><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7M8 15h8M8 18h5"/></svg>
  if (name === 'spark') return <svg {...common}><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z"/></svg>
  if (name === 'upload') return <svg {...common}><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M20 16.5v2A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-2"/></svg>
  if (name === 'close') return <svg {...common}><path d="m18 6-12 12M6 6l12 12"/></svg>
  if (name === 'arrow') return <svg {...common}><path d="M5 12h14m-6-6 6 6-6 6"/></svg>
  return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 8v4m0 4h.01"/></svg>
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function App() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [submittedQuestion, setSubmittedQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  function chooseFile(file) {
    if (!file) return
    setError('')
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file.')
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    setSelectedFile(file)
    setAnswer('')
    setSubmittedQuestion('')
    if (inputRef.current) inputRef.current.value = ''
  }

  function removeFile() {
    setSelectedFile(null)
    setAnswer('')
    setSubmittedQuestion('')
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  async function askQuestion(event) {
    event.preventDefault()
    setError('')
    if (!selectedFile) { setError('Choose a PDF before asking a question.'); return }
    if (!question.trim()) { setError('Enter a question about your document.'); return }

    const formData = new FormData()
    formData.append('pdf', selectedFile)
    formData.append('question', question.trim())
    setLoading(true)
    setAnswer('')
    setSubmittedQuestion(question.trim())
    try {
      const response = await fetch(`${API_BASE_URL}/upload`, { method: 'POST', body: formData })
      const responseText = await response.text()
      if (!response.ok) {
        console.error('PDF backend returned an error:', response.status, responseText)
        throw new Error(response.status === 404 ? 'The upload service was not found. Check that the backend is running.' : 'Something went wrong while processing the PDF. Please try again.')
      }
      if (!responseText.trim()) throw new Error('The server returned an empty answer. Please try again.')
      setAnswer(responseText)
    } catch (requestError) {
      console.error('PDF question request failed:', requestError)
      setError(requestError instanceof TypeError ? 'Unable to connect to the server. Make sure the backend is running on port 3000 and CORS is enabled.' : requestError.message || 'Something went wrong. Please try again.')
      setSubmittedQuestion('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-slate-900">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <a href="#main" className="flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white"><Icon name="file" /></span>
            <span><span className="block text-sm font-semibold tracking-tight">Papertrail</span><span className="block text-xs text-slate-500">Your document assistant</span></span>
          </a>
          <div className="hidden items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Private document analysis</div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
        <section className="mx-auto mb-9 max-w-2xl text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Icon name="spark" /></div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Ask your document</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">A clearer way to read PDFs.</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">Upload a document, ask a question, and get a focused answer grounded in its content.</p>
        </section>

        <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[0.88fr_1.12fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] sm:p-6" aria-labelledby="upload-heading">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Step 01</p><h2 id="upload-heading" className="text-lg font-semibold tracking-tight">Add your document</h2><p className="mt-1 text-sm text-slate-500">Choose a PDF to get started.</p></div>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">PDF only</span>
            </div>
            <input ref={inputRef} id="pdf-upload" type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0])} aria-label="Choose a PDF file" />
            {!selectedFile ? (
              <label htmlFor="pdf-upload" className="group flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-5 text-center transition hover:border-indigo-400 hover:bg-indigo-50/40 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2">
                <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-indigo-600 shadow-sm transition group-hover:border-indigo-200"><Icon name="upload" className="h-6 w-6" /></span>
                <span className="text-sm font-semibold text-slate-800">Choose a PDF to upload</span>
                <span className="mt-1 text-xs text-slate-500">Browse files from your device</span>
                <span className="mt-4 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">Browse files</span>
              </label>
            ) : (
              <div className="flex min-h-56 flex-col justify-center rounded-xl border border-indigo-100 bg-indigo-50/40 p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm"><Icon name="file" /></span>
                  <div className="min-w-0 flex-1"><p className="break-all text-sm font-semibold text-slate-800">{selectedFile.name}</p><p className="mt-1 text-xs text-slate-500">PDF document · {formatSize(selectedFile.size)}</p></div>
                  <button type="button" onClick={removeFile} disabled={loading} aria-label="Remove selected PDF" className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-40"><Icon name="close" className="h-4 w-4" /></button>
                </div>
                <button type="button" onClick={() => inputRef.current?.click()} disabled={loading} className="mt-5 self-start text-xs font-semibold text-indigo-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-40">Replace document</button>
              </div>
            )}
            <div className="mt-4 flex items-center gap-2 text-xs leading-5 text-slate-500"><span className="text-emerald-600">✓</span> Your PDF is sent to the document assistant for analysis.</div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] sm:p-6" aria-labelledby="question-heading">
            <div className="mb-5"><p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Step 02</p><h2 id="question-heading" className="text-lg font-semibold tracking-tight">What would you like to know?</h2><p className="mt-1 text-sm text-slate-500">Ask a specific question about the document.</p></div>
            <form onSubmit={askQuestion}>
              <label htmlFor="question" className="mb-2 block text-sm font-medium text-slate-700">Your question</label>
              <textarea id="question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={2000} rows={5} placeholder="For example: What are the key takeaways?" disabled={loading} className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-50" />
              <div className="mt-2 flex items-center justify-between text-xs text-slate-400"><span>Answers are generated from your uploaded PDF.</span><span>{question.length}/2000</span></div>
              {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm leading-5 text-rose-700"><Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
              <button type="submit" disabled={loading} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-indigo-400">
                {loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Analyzing your PDF…</> : <>Ask question <Icon name="arrow" className="h-4 w-4" /></>}
              </button>
            </form>
          </section>
        </div>

        {(loading || answer) && <section className="mx-auto mt-5 max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] sm:p-6" aria-live="polite" aria-busy={loading}>
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon name="spark" className="h-4 w-4" /></span><div><p className="text-sm font-semibold">{loading ? 'Finding your answer' : 'Answer'}</p><p className="text-xs text-slate-500">{loading ? 'Reading the document and preparing a response…' : 'Based on your document'}</p></div></div>
          {submittedQuestion && <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Your question</p><p className="text-sm leading-6 text-slate-700">{submittedQuestion}</p></div>}
          {loading ? <div className="mt-4 space-y-2" aria-hidden="true"><div className="h-3 w-full animate-pulse rounded bg-slate-100"/><div className="h-3 w-5/6 animate-pulse rounded bg-slate-100"/><div className="h-3 w-2/3 animate-pulse rounded bg-slate-100"/></div> : <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{answer}</p>}
        </section>}

        <footer className="mx-auto mt-8 max-w-5xl text-center text-xs text-slate-400">Document answers can make mistakes. Check important details against the original PDF.</footer>
      </main>
    </div>
  )
}
