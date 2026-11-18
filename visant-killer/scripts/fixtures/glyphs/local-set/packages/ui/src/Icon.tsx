/* The repo's own Icon component. The file is named for the icon set, so the rule skips it. */
export function Icon({ name }: { name: string }) {
  return <span data-icon={name} />;
}
