export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="128" height="128" rx="24" fill="var(--icon-weak-base)" />
      <g transform="translate(35.5, 16.5) scale(1)">
        <path d="M13.824 94.08C12.544 94.08 11.904 93.6107 11.904 92.672C11.904 91.7334 12.4587 91.2214 13.568 91.136L19.328 90.24C21.0347 89.984 22.1867 89.5574 22.784 88.96C23.3813 88.2774 23.68 87.04 23.68 85.248V8.44801C23.68 7.25335 23.424 6.40001 22.912 5.88802C22.4 5.37601 21.3333 5.12001 19.712 5.12001C16.5547 5.12001 13.44 6.48534 10.368 9.21601C7.296 11.9467 5.29067 16.3413 4.352 22.4L3.712 26.624C3.54133 27.7334 2.944 28.288 1.92 28.288C0.640001 28.288 0.0853346 27.5627 0.256001 26.112L1.408 2.94402C1.57867 0.981349 2.34667 1.52588e-05 3.712 1.52588e-05C4.30933 1.52588e-05 4.864 0.170682 5.376 0.512016C5.888 0.768013 6.74133 1.06668 7.936 1.40801C9.216 1.74935 11.2213 1.92001 13.952 1.92001H42.496C45.2267 1.92001 47.1893 1.74935 48.384 1.40801C49.664 1.06668 50.56 0.768013 51.072 0.512016C51.6693 0.170682 52.224 1.52588e-05 52.736 1.52588e-05C54.1013 1.52588e-05 54.8693 0.981349 55.04 2.94402L56.192 26.112C56.3627 27.5627 55.808 28.288 54.528 28.288C53.504 28.288 52.9067 27.7334 52.736 26.624L52.096 22.4C51.2427 16.3413 49.28 11.9467 46.208 9.21601C43.136 6.48534 39.9787 5.12001 36.736 5.12001C35.1147 5.12001 34.048 5.37601 33.536 5.88802C33.024 6.40001 32.768 7.25335 32.768 8.44801V85.248C32.768 87.04 33.0667 88.2774 33.664 88.96C34.3467 89.5574 35.4987 89.984 37.12 90.24L42.88 91.136C43.9893 91.2214 44.544 91.7334 44.544 92.672C44.544 93.6107 43.904 94.08 42.624 94.08H13.824Z" fill="var(--icon-strong-base)" />
      </g>
    </svg>
  )
}

export const Logo = (props: { class?: string }) => {
  const asciiLogo = `
MMP""MM""YMM \`7MM                                                            \`7MM
P'   MM   \`7   MM                                                              MM
     MM        MMpMMMb.\`7MM  \`7MM  \`7Mb,od8 .P"Ybmmm ,pW"Wq.   ,pW"Wq.    ,M""bMM
     MM        MM    MM  MM    MM    MM' "':MI  I8  6W'   \`Wb 6W'   \`Wb ,AP    MM
     MM        MM    MM  MM    MM    MM     WmmmP"  8M     M8 8M     M8 8MI    MM
     MM        MM    MM  MM    MM    MM    8M       YA.   ,A9 YA.   ,A9 \`Mb    MM
   .JMML.    .JMML  JMML.\`Mbod"YML..JMML.   YMMMMMb  \`Ybmd9'   \`Ybmd9'   \`Wbmd"MML.
                                           6'     dP
                                           Ybmmmd'
`.trim()

  return (
    <pre
      classList={{ [props.class ?? ""]: !!props.class }}
      style={{
        "font-family": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        "font-size": "6px",
        "line-height": "1.2",
        "white-space": "pre",
        color: "var(--icon-base)",
        opacity: "0.5",
      }}
    >
      {asciiLogo}
    </pre>
  )
}
