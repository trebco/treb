
/** imported html as text */
declare module '*.html' {
  const text: string;
  export default text;
}

/** imported css as text */
declare module '*.scss' {
  const text: string;
  export default text;
}

/** workers imported as text */
declare module 'worker:*' {
  const text: string;
  export default text;
}

/** workers imported as text */
declare module '*!worker' {
  const text: string;
  export default text;
}
