// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1B\[[0-9;]*[mGKHF]/g, '');

interface BuildLineProps {
  line: string;
}

export function BuildLine({ line }: BuildLineProps) {
  const clean = stripAnsi(line);
  let cls = 'text-[#7a7a7a]';
  if (/^Step \d+/i.test(clean)) cls = 'text-[#60a5fa]';
  else if (/successfully|complete/i.test(clean)) cls = 'text-green';
  else if (/\berror\b/i.test(clean)) cls = 'text-red';
  return <div className={cls}>{clean || ' '}</div>;
}
