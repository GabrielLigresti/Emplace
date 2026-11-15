import type { ModelViewerElement } from '@google/model-viewer';

// <model-viewer> es un web component: estos son los atributos que usa la app.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<ModelViewerElement>,
        ModelViewerElement
      > & {
        src?: string;
        'ios-src'?: string;
        alt?: string;
        poster?: string;
        ar?: boolean;
        'ar-modes'?: string;
        'ar-scale'?: string;
        'camera-controls'?: boolean;
        'auto-rotate'?: boolean;
        'shadow-intensity'?: string;
        'touch-action'?: string;
        scale?: string;
      };
    }
  }
}
