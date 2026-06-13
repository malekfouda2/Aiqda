import { useEffect } from 'react';

let activeLocks = 0;
let lockedScrollY = 0;
let previousBodyStyles = null;
let previousHtmlOverflow = '';

const lockBodyScroll = () => {
  const { body, documentElement } = document;

  if (activeLocks === 0) {
    lockedScrollY = window.scrollY || documentElement.scrollTop || 0;
    previousBodyStyles = {
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    previousHtmlOverflow = documentElement.style.overflow;

    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${lockedScrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    documentElement.style.overflow = 'hidden';
  }

  activeLocks += 1;
};

const unlockBodyScroll = () => {
  if (activeLocks === 0) {
    return;
  }

  activeLocks -= 1;

  if (activeLocks > 0) {
    return;
  }

  const { body, documentElement } = document;

  if (previousBodyStyles) {
    body.style.overflow = previousBodyStyles.overflow;
    body.style.paddingRight = previousBodyStyles.paddingRight;
    body.style.position = previousBodyStyles.position;
    body.style.top = previousBodyStyles.top;
    body.style.left = previousBodyStyles.left;
    body.style.right = previousBodyStyles.right;
    body.style.width = previousBodyStyles.width;
  }

  documentElement.style.overflow = previousHtmlOverflow;
  window.scrollTo({ top: lockedScrollY, left: 0, behavior: 'auto' });
};

function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) {
      return undefined;
    }

    lockBodyScroll();

    return () => {
      unlockBodyScroll();
    };
  }, [locked]);
}

export default useBodyScrollLock;
