export function HeadingFor  ()  {
  return (
    <section className="bg-gray-100 py-16">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row md:items-start md:justify-between gap-10">
        
        {/* Left Side Heading */}
        <div className="space-y-2 text-left">
          <h1 className="text-4xl md:text-5xl font-extrabold text-red-500">
            Made for Little Hands
          </h1>
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-800">
            Made for Big Fun
          </h2>
        </div>

        {/* Right Side Description */}
        <div className="max-w-md text-gray-600 text-base leading-relaxed">
          <p>
            Little Steps creates safe, fun, and thoughtfully designed toys that
            help children learn through play. Every product supports early
            development, creativity, and joyful milestones—because every big
            journey begins with little steps.
          </p>
        </div>

      </div>
    </section>
  );
};
