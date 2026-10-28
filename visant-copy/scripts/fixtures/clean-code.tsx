// Code that is not copy: none of this may fire.
export function Pager({ i, links, value }) {
  const prev = i !== 0 ? links[i - 1] : null
  console.log("Skipping getMenu - Shopify not configured")
  const radius = "calc(var(--radius) - 2px)"
  return <div style={{ transform: `translateX(-${100 - (value || 0)}%)` }}>Next page</div>
}
