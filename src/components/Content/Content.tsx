import type { ReactNode } from "react";
import styles from "./Content.module.scss";

interface Props {
  /** AR/map overlays + HUD as children. Each absolute-fills the content area
   *  via the .content > * rule in the module. */
  children?: ReactNode;
}

/** Pokédex content area. Renders between header and footer with red side
 *  borders. Stays transparent so the full-window camera canvas (rendered
 *  at the App root) shows through. */
export function Content({ children }: Props) {
  return <main className={styles.content}>{children}</main>;
}
