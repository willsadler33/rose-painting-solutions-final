/** Shown only to the signed-in owner when previewing unpublished changes. */
export default function PreviewBanner({ failed = false }) {
  return (
    <div role="status" className="preview-banner">
      <span>
        {failed
          ? 'Preview unavailable — sign in to the dashboard first. You’re seeing the live website.'
          : 'Preview of your unpublished changes. Visitors can’t see this yet.'}
      </span>
      <a href="./admin/">Back to dashboard</a>
    </div>
  )
}
