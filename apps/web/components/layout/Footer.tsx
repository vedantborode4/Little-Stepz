export default function Footer() {
  return (
    <footer className="bg-[#111] text-gray-300 mt-16">
      <div className="max-w-7xl mx-auto px-6 py-12 grid md:grid-cols-4 gap-8">

        <div>
          <h4 className="font-semibold text-white mb-4">Category</h4>
          <ul className="space-y-2 text-sm">
            <li>Action Figures</li>
            <li>Board Games</li>
            <li>Soft Toys</li>
            <li>Learning</li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-white mb-4">Popular Brands</h4>
          <ul className="space-y-2 text-sm">
            <li>Lego</li>
            <li>Hot Wheels</li>
            <li>Barbie</li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-white mb-4">Information</h4>
          <ul className="space-y-2 text-sm">
            <li>Contact Us</li>
            <li>Shipping Policy</li>
            <li>Returns</li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-white mb-4">Newsletter</h4>

          <div className="flex">
            <input
              placeholder="Your email address"
              className="flex-1 px-3 py-2 rounded-l-lg text-black"
            />
            <button className="bg-primary px-4 rounded-r-lg text-white">
              Submit
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}
