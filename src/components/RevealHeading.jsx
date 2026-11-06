import { useInView } from '../hooks/useInView.js'

/** A heading that rises out of a mask the first time it scrolls into view. */
export default function RevealHeading({ as: Tag = 'h2', id, className = '', children }) {
  const [ref, inView] = useInView({ threshold: 0.6 })
  return (
    <Tag ref={ref} id={id} className={`reveal-h ${inView ? 'is-in' : ''} ${className}`}>
      <span>
        <span>{children}</span>
      </span>
    </Tag>
  )
}
