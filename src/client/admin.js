const supportedIconTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maximumIconBytes = 2 * 1024 * 1024
let previewUrl

const scheduleAutoDismiss = () => {
  document
    .querySelectorAll('[data-auto-dismiss]:not([data-auto-dismiss-scheduled])')
    .forEach((notice) => {
      notice.setAttribute('data-auto-dismiss-scheduled', '')

      const configuredDelay = Number(notice.getAttribute('data-auto-dismiss'))
      const delay = Number.isFinite(configuredDelay) ? configuredDelay : 4500

      window.setTimeout(() => notice.remove(), delay)
    })
}

document.addEventListener('DOMContentLoaded', scheduleAutoDismiss)
document.addEventListener('htmx:afterSettle', scheduleAutoDismiss)

const favoritesList = document.querySelector('[data-admin-favorites-list]')
const orderStatus = document.querySelector('#favorites-order-status')
let orderStatusTimer
let sortable

const favoriteRows = () =>
  favoritesList
    ? [...favoritesList.querySelectorAll('[data-admin-favorite-row]')]
    : []

const orderedFavoriteIds = () =>
  favoriteRows()
    .map((row) => row.getAttribute('data-favorite-id'))
    .filter(Boolean)

const refreshMoveButtons = (disabled = false) => {
  const rows = favoriteRows()

  rows.forEach((row, index) => {
    const up = row.querySelector('[data-move-favorite="up"]')
    const down = row.querySelector('[data-move-favorite="down"]')

    if (up instanceof HTMLButtonElement) up.disabled = disabled || index === 0
    if (down instanceof HTMLButtonElement) {
      down.disabled = disabled || index === rows.length - 1
    }
  })
}

const showOrderStatus = (message, tone = 'neutral') => {
  if (!orderStatus) return

  window.clearTimeout(orderStatusTimer)
  orderStatus.textContent = message
  orderStatus.classList.remove(
    'text-base-content/55',
    'text-success',
    'text-error',
  )
  orderStatus.classList.add(
    tone === 'success'
      ? 'text-success'
      : tone === 'error'
        ? 'text-error'
        : 'text-base-content/55',
  )

  if (tone === 'success') {
    orderStatusTimer = window.setTimeout(() => {
      showOrderStatus(
        'Drag a row or use its Move buttons to change the portal order.',
      )
    }, 3500)
  }
}

const persistFavoriteOrder = async () => {
  sortable?.option('disabled', true)
  refreshMoveButtons(true)
  showOrderStatus('Saving order…')

  try {
    const response = await fetch('/admin/favorites/reorder', {
      body: JSON.stringify({ ids: orderedFavoriteIds() }),
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })

    if (!response.ok) throw new Error('Favorite order could not be saved.')

    showOrderStatus('Order saved.', 'success')
    sortable?.option('disabled', false)
    refreshMoveButtons()
  } catch {
    showOrderStatus(
      'Could not save the order. Restoring the saved order…',
      'error',
    )
    window.setTimeout(() => window.location.reload(), 1200)
  }
}

if (favoritesList && typeof Sortable !== 'undefined') {
  sortable = new Sortable(favoritesList, {
    animation: 150,
    draggable: '[data-admin-favorite-row]',
    ghostClass: 'admin-sortable-ghost',
    handle: '.admin-drag-handle',
    onEnd: (event) => {
      if (event.oldIndex !== event.newIndex) void persistFavoriteOrder()
    },
  })

  refreshMoveButtons()
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element) || !favoritesList) return

  const button = event.target.closest('[data-move-favorite]')
  const row = button?.closest('[data-admin-favorite-row]')

  if (!(button instanceof HTMLButtonElement) || !row) return

  const direction = button.getAttribute('data-move-favorite')
  const neighbor =
    direction === 'up' ? row.previousElementSibling : row.nextElementSibling

  if (!neighbor?.matches('[data-admin-favorite-row]')) return

  if (direction === 'up') {
    favoritesList.insertBefore(row, neighbor)
  } else {
    favoritesList.insertBefore(neighbor, row)
  }

  button.focus()
  void persistFavoriteOrder()
})

document.addEventListener('htmx:afterSettle', () => refreshMoveButtons())

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
