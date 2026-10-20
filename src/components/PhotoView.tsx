import { useState } from 'react';
import { useImageUrl } from '../lib/useImageUrl';
import { useRoomCtx } from '../lib/context';
import type { RoomImage } from '../types/game';

/** An anonymous photo with its optional caption. Click to enlarge. */
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
      <button className="imgbtn" onClick={() => setOpen(true)} aria-label="Enlarge image">
        {failed ? (
          <div className="ph">Image unavailable</div>
        ) : url ? (
          <img src={url} alt="Game image" loading="lazy" onError={onError} />
        ) : (
          <div className="ph shimmer" />
        )}
      </button>
      {(image.caption || children) && (
        <figcaption>
          {image.caption && <span className="quote">“{image.caption}”</span>}
          {children}
        </figcaption>
      )}
      {open && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <button className="close" onClick={() => setOpen(false)} aria-label="Close">
            ✕
          </button>
          <div onClick={(e) => e.stopPropagation()}>
            {url && !failed ? (
              <img src={url} alt="Enlarged image" onError={onError} />
            ) : (
              <div className="ph">Image unavailable</div>
            )}
            {image.caption && <p>{image.caption}</p>}
          </div>
        </div>
      )}
    </figure>
  );
}
