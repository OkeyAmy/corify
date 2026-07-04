export default function StatusBadge({
  label,
}: Readonly<{ label: string }>): React.ReactElement {
  return <span className="status-badge">{label}</span>;
}
