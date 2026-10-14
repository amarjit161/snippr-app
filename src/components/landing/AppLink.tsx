import type { AnchorHTMLAttributes } from "react";
import { Link } from "react-router-dom";
import { appHref } from "@/lib/domains";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  /** App route, e.g. "/salons". Becomes https://app.snippr.in/... on the marketing host. */
  to: string;
};

/** Link into the booking app: client-side when same-origin, a real cross-host link otherwise. */
export function AppLink({ to, children, ...rest }: Props) {
  const href = appHref(to);
  if (/^https?:\/\//.test(href)) {
    return <a href={href} {...rest}>{children}</a>;
  }
  return <Link to={href} {...rest}>{children}</Link>;
}
