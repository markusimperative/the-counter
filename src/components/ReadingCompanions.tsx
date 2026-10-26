import { readingCompanions } from '../reading/companions'
import './reading-companions.css'

export function ReadingCompanions({ variant }: { variant: 'opening' | 'ending' }) {
  const titleId = 'reading-companions-' + variant
  const Heading = variant === 'opening' ? 'h2' : 'h3'
  const ArticleHeading = variant === 'opening' ? 'h3' : 'h4'
  return <section className={'reading-companions companions-' + variant} aria-labelledby={titleId}>
    <header className="companions-introduction">
      <Heading id={titleId}>{variant === 'opening' ? 'Reading Companions' : 'Continue exploring'}</Heading>
      <p>Three companion essays. Optional reading, before or after your shift.</p>
    </header>
    <ol className="companions-list">
      {readingCompanions.map(article => <li className="companion" key={article.order}>
        {article.image && <img src={article.image.src} alt={article.image.alt} loading="lazy" />}
        <span className="companion-part">Part {article.part}</span>
        <ArticleHeading id={'companion-' + variant + '-' + article.order}>{article.title}</ArticleHeading>
        <p className="companion-teaser">{article.teaser}</p>
        {article.publication.state === 'published'
          ? <a className="companion-link" href={article.publication.verifiedPublicUrl} target="_blank" rel="noopener noreferrer" aria-label={`Read article: ${article.title} (opens in a new tab)`}>Read article <span aria-hidden="true">↗</span></a>
          : <span className="companion-unpublished">Coming soon</span>}
      </li>)}
    </ol>
  </section>
}
