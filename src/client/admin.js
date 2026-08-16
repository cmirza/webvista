const supportedIconTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maximumIconBytes = 2 * 1024 * 1024
let previewUrl

const showUploadPreview = (input) => {
  const target = input.form?.querySelector('#favorite-icon-preview')
  const file = input.files?.[0]

  if (!target || !file) return

  input.form?.querySelector('#favorite-icon-file-error')?.remove()
  input.removeAttribute('aria-describedby')

  if (previewUrl) URL.revokeObjectURL(previewUrl)
  target.replaceChildren()

  if (!supportedIconTypes.has(file.type) || file.size > maximumIconBytes) {
    const warning = document.createElement('div')
    warning.className = 'alert alert-warning py-3 text-sm'
    warning.setAttribute('role', 'alert')
    warning.textContent = supportedIconTypes.has(file.type)
      ? 'Custom icons must be 2 MB or smaller.'
      : 'Choose a PNG, JPEG, or WebP image.'
    target.append(warning)
    return
  }

  previewUrl = URL.createObjectURL(file)
  const wrapper = document.createElement('div')
  wrapper.className = 'flex items-center gap-4'
  wrapper.dataset.iconPreviewResult = ''

  const iconShell = document.createElement('span')
  iconShell.className = 'favorite-icon favorite-icon--admin'
  const image = document.createElement('img')
  image.src = previewUrl
  image.alt = ''
  image.className = 'favorite-icon__image'
  iconShell.append(image)

  const copy = document.createElement('div')
  const name = document.createElement('p')
  name.className = 'font-semibold'
  name.textContent = file.name
  const detail = document.createElement('p')
  detail.className = 'mt-1 text-sm text-base-content/60'
  detail.textContent = 'This image will be uploaded when you add the favorite.'
  copy.append(name, detail)
  wrapper.append(iconShell, copy)
  target.append(wrapper)
}

document.addEventListener('change', (event) => {
  if (!(event.target instanceof HTMLInputElement)) return

  if (event.target.matches('[data-custom-icon-input]')) {
    const uploadMode = event.target.form?.querySelector('[name="iconMode"][value="upload"]')
    if (uploadMode instanceof HTMLInputElement) uploadMode.checked = true
    showUploadPreview(event.target)
  }
})
