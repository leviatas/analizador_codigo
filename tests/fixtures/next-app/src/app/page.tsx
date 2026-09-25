import Link from 'next/link'
import { Button } from '@acme/ui'
import { format } from '@/lib/format'
export default async function Home() {
  const data = await fetch('http://api.example.com/items')
  return <main><Link href="/blog/x">Blog</Link><Button /></main>
}
