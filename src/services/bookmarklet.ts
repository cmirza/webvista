export const createForYouBookmarklet = (applicationOrigin: string): string => {
  const origin = new URL(applicationOrigin)
  if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== applicationOrigin) {
    throw new Error('Bookmarklet origin must be an absolute HTTP or HTTPS origin.')
  }

  const previewUrl = `${origin.origin}/admin/for-you/preview`
  return `javascript:(()=>{const m=(...s)=>s.map(x=>document.querySelector(x)?.getAttribute("content")?.trim()).find(Boolean)||"";const p=new URLSearchParams({capture:"browser",url:location.href,title:m('meta[property="og:title"]','meta[name="twitter:title"]')||document.title,description:m('meta[property="og:description"]','meta[name="twitter:description"]','meta[name="description"]'),imageUrl:m('meta[property="og:image:secure_url"]','meta[property="og:image"]','meta[name="twitter:image"]','meta[name="twitter:image:src"]'),sourceName:m('meta[property="og:site_name"]')||location.hostname.replace(/^www\\./,"")});window.open(${JSON.stringify(previewUrl)}+"?"+p.toString(),"_blank","noopener")})()`
}
