export default function Post({ params }) {
  return <article dangerouslySetInnerHTML={{ __html: params.html }} />
}
