declare module "*.py" {
  /** Path to the asset; inside a compiled executable this is the embedded `/$bunfs` path. */
  const path: string;
  export default path;
}
