export default function PreviewLabPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Preview Lab</h1>
          <p className="text-gray-400">
            This page is visible only to experiment owners. Use it to test UI and UX ideas before releasing them to everyone.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <article className="card p-5 border border-accent-blue/30">
            <h2 className="text-lg font-semibold text-white mb-2">Idea Slot A</h2>
            <p className="text-sm text-gray-400">Drop your first prototype component here.</p>
          </article>
          <article className="card p-5 border border-accent-green/30">
            <h2 className="text-lg font-semibold text-white mb-2">Idea Slot B</h2>
            <p className="text-sm text-gray-400">Use this space for variant comparisons.</p>
          </article>
        </section>
      </div>
    </div>
  );
}
