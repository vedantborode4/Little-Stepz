import { FileText } from "lucide-react"
import { getPolicy, type PolicySlug, type PolicyBlock } from "@repo/content/index"

function Block({ block }: { block: PolicyBlock }) {
  if (block.type === "subheading") {
    return (
      <h3 className="font-sans text-base font-semibold text-text mt-5 mb-1.5">
        {block.text}
      </h3>
    )
  }

  if (block.type === "list") {
    return (
      <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted leading-relaxed">
        {block.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    )
  }

  return <p className="text-sm text-muted leading-relaxed">{block.text}</p>
}

export default function PolicyView({ slug }: { slug: PolicySlug }) {
  const page = getPolicy(slug)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-primary/10 rounded-xl">
          <FileText size={18} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-text">{page.title}</h1>
      </div>

      {/* Content card */}
      <div className="bg-surface rounded-2xl border border-border shadow-card p-6 sm:p-8 space-y-7">
        {page.intro && (
          <p className="text-sm text-muted leading-relaxed">{page.intro}</p>
        )}

        {page.sections.map((section, si) => (
          <section key={si} className="space-y-2.5">
            {section.heading && (
              <h2 className="font-sans text-lg font-bold text-text">
                {section.heading}
              </h2>
            )}
            {section.blocks.map((block, bi) => (
              <Block key={bi} block={block} />
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
