import Link from "next/link";
import { MermaidView } from "@/components/app/mermaid-view";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { docSlugForHref, getDocMeta, listDocs, readDocMarkdown } from "@/lib/md-docs";
import { TutorialFocusOnMount, TutorialSearch } from "@/components/app/docs-tutorial";
import { requirePageUser } from "@/lib/server/page-auth";

const mdComponents: Components = {
  h1: () => null,
  h2: ({ children }) => (
    <h2 className="mt-8 border-b border-line-warm pb-1.5 font-display text-base font-bold tracking-tight text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-5 font-display text-[15px] font-bold text-foreground">{children}</h3>
  ),
  h4: ({ children }) => <h4 className="mt-4 text-sm font-semibold text-foreground">{children}</h4>,
  p: ({ children }) => <p className="my-2.5 text-sm leading-relaxed text-foreground/90">{children}</p>,
  a: ({ children, href }) => {
    const internal = href ? docSlugForHref(href) : null;
    const resolvedHref = internal ? `/docs/${internal}` : href ?? "#";
    return (
      <a href={resolvedHref} className="font-semibold text-primary underline underline-offset-2">
        {children}
      </a>
    );
  },
  ul: ({ children }) => <ul className="my-2.5 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2.5 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="text-sm leading-relaxed text-foreground/90">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-4 border-warning bg-warning/10 px-4 py-2.5 text-sm text-warning-soft-foreground">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="relative my-4 w-full overflow-x-auto rounded-lg border border-line-warm">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="[&_tr]:border-0">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-line-warm transition-colors hover:bg-table-hover">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="bg-table-head px-3 py-2 text-left align-middle text-[11.5px] font-semibold uppercase tracking-[0.5px] text-table-head-fg">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="px-3 py-2.5 align-top text-foreground/90">{children}</td>,
  hr: () => <hr className="my-6 border-line" />,
  img: ({ src, alt, title }) => (
    <figure className="my-4">
      {/* empat kotak responsif */}
      <img
        src={typeof src === "string" ? src : ""}
        alt={alt ?? ""}
        title={title}
        loading="lazy"
        className="w-full rounded-xl border border-line-warm bg-surface shadow-sm"
      />
      {title ? (
        <figcaption className="mt-1.5 text-center text-xs text-muted-foreground">{title}</figcaption>
      ) : null}
    </figure>
  ),
  code: ({ children, className }) => {
    const isMermaid = typeof className === "string" && className.includes("language-mermaid");
    if (isMermaid) {
      return <MermaidView chart={String(children ?? "")} />;
    }
    const isBlock = typeof className === "string" && className.includes("language-");
    if (isBlock) {
      return <code className="font-data">{children}</code>;
    }
    return (
      <code className="rounded bg-muted px-1 py-0.5 font-data text-[12.5px] text-foreground">
        {children}
      </code>
    );
  },
  pre: ({ children }) => {
    // bypass <pre> bila isinya diagram mermaid (sudah dirender MermaidView)
    const child = children as { props?: { className?: string; chart?: string } } | undefined;
    if (child && typeof child === "object" && "props" in child) {
      const cls = (child.props as { className?: string }).className ?? "";
      const chart = (child.props as { chart?: string }).chart;
      if ((typeof cls === "string" && cls.includes("language-mermaid")) || typeof chart === "string") return <>{children}</>;
    }
    return (
      <pre className="my-4 overflow-x-auto rounded-lg bg-[#141d2b] p-3.5 text-xs leading-relaxed text-zinc-100">
        {children}
      </pre>
    );
  },
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
};

export default async function DocsDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  await requirePageUser();
  const { slug } = await params;
  const { m } = await searchParams;
  const meta = getDocMeta(slug);
  const content = meta ? await readDocMarkdown(slug) : null;
  if (!meta || content === null) notFound();

  const headings = (content.match(/^#{2,3} (.+)$/gm) ?? []).map((line) =>
    line.replace(/^#{2,3} /, "").replace(/\s+/g, " ").trim()
  );

  const others = listDocs().filter((doc) => doc.slug !== slug);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={meta.title}
        description={`${meta.audience} · diambil dari folder docs/ aplikasi`}
        actions={
          <Link
            href="/docs"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="h-4 w-4" /> Daftar dokumen
          </Link>
        }
      />

      <Card>
        <CardContent>
          <div data-doc-content>
            <TutorialSearch headings={headings} focusLabel={m} />
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {content}
            </ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 flex flex-wrap gap-2">
        {others.map((doc) => (
          <Link
            key={doc.slug}
            href={`/docs/${doc.slug}`}
            className="rounded-lg border border-line-warm bg-surface px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {doc.title} →
          </Link>
        ))}
      </div>
    </div>
  );
}
