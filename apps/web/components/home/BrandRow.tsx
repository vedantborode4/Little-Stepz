const brands = ["marvel.png", "disney.png", "barbie.png"]

export default function BrandRow() {
  return (
    <div className="flex flex-wrap justify-center gap-10 items-center">
      {brands.map((b) => (
        <img key={b} src={`/brands/${b}`} className="h-8" />
      ))}
    </div>
  )
}
