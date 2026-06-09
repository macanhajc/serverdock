interface FormSectionProps {
  title: string;
  desc: string;
  children: React.ReactNode;
}

export function FormSection({ title, desc, children }: FormSectionProps) {
  return (
    <div className="border-t border-line py-6">
      <h3 className="m-0 mb-1 text-sm font-bold">{title}</h3>
      <p className="m-0 mb-4 text-xs text-ink-3">{desc}</p>
      {children}
    </div>
  );
}
