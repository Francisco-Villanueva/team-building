import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useImageUrl } from '../lib/useImageUrl';
import { useRoomCtx } from '../lib/context';
import type { RoomImage } from '../types/game';

/** Full-size view. Rendered in a portal so it is never clipped by cards (transform / overflow). */
function PhotoDialog({
  url,
  failed,
  caption,
  onError,
  onClose,
}: {
  url: string | null;
  failed: boolean;
  caption: string | null;
  onError: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div className="photo-dialog" role="dialog" aria-modal="true" aria-label="Full-size photo" onClick={onClose}>
      <button className="close" onClick={onClose} aria-label="Close" autoFocus>
        ✕
      </button>
      <div className="frame" onClick={(e) => e.stopPropagation()}>
        {url && !failed ? <img src={url} alt="Full-size game image" onError={onError} /> : <div className="ph">Image unavailable</div>}
        {caption && <p className="caption">“{caption}”</p>}
      </div>
    </div>,
    document.body,
  );
}

/** An anonymous photo with its optional caption. Click it to see the whole photo. */
export function PhotoView({
  image,
  size = 'large',
  children,
}: {
  image: RoomImage;
  size?: 'large' | 'small';
  children?: React.ReactNode;
}) {
  const { session } = useRoomCtx();
  const { url, failed, onError } = useImageUrl(session, image.id);
  const [open, setOpen] = useState(false);

  return (
    <figure className={`tile ${size === 'large' ? 'large' : ''}`}>
      <button className="imgbtn" onClick={() => setOpen(true)} aria-label="View full photo">
        {failed ? (
          <div className="ph">Image unavailable</div>
        ) : url ? (
          <img src={url} alt="Game image" loading="lazy" onError={onError} />
        ) : (
          <div className="ph shimmer" />
        )}
        {url && !failed && <span className="expand-hint">⤢ View full photo</span>}
      </button>
      {(image.caption || children) && (
        <figcaption>
          {image.caption && <span className="quote">“{image.caption}”</span>}
          {children}
        </figcaption>
      )}
      {open && (
        <PhotoDialog url={url} failed={failed} caption={image.caption} onError={onError} onClose={() => setOpen(false)} />
      )}
    </figure>
  );
}
