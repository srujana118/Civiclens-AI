type PageHeaderProps = {
  title: string;
  subtitle: string;
};

export default function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
      <div className="animate-fade-in">
        <h1 className="text-3xl font-semibold tracking-tight text-[#1e1e1e] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-base text-[#6b6b6b]">{subtitle}</p>
      </div>
    </div>
  );
}
