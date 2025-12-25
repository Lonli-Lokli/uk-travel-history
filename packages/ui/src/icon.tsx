import {
  Airplane01Icon,
  AlertCircleIcon,
  AlertTriangle,
  ArrowDown02Icon,
  ArrowLeft02Icon,
  ArrowRight02Icon,
  ArrowUp02Icon,
  Calendar01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  CircleIcon,
  ClipboardIcon,
  Coffee01Icon,
  Delete02Icon,
  Download01Icon,
  DragDropVerticalIcon,
  FingerPrintScanIcon,
  HandPointingRight01Icon,
  Happy01Icon,
  InformationCircleIcon,
  Loading03Icon,
  Logout01Icon,
  Menu01Icon,
  MultiplicationSignIcon,
  NoteAddIcon,
  Passport01Icon,
  Pdf02Icon,
  PencilEdit01Icon,
  PlusSignIcon,
  Target01Icon,
  TransactionHistoryIcon,
  Upload01Icon,
  X,
  Xls02Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon, IconSvgElement } from '@hugeicons/react';
import { NeverError } from '@uth/utils';
import { FC } from 'react';

export type IconName =
  | 'loading'
  | 'info-circle'
  | 'pdf'
  | 'xlsx'
  | 'clipboard'
  | 'check'
  | 'arrow-right'
  | 'alert-circle'
  | 'check-circle'
  | 'note-add'
  | 'fingerprint'
  | 'airplane'
  | 'import'
  | 'export'
  | 'user'
  | 'logout'
  | 'coffee'
  | 'hand-right'
  | 'alert'
  | 'target'
  | 'trash'
  | 'history'
  | 'circle-x'
  | 'x'
  | 'passport'
  | 'arrow-left'
  | 'arrow-up'
  | 'arrow-down'
  | 'calendar'
  | 'pencil'
  | 'circle'
  | 'plus'
  | 'drag-drop'
  | 'alert-triangle'
  | 'menu'
  | 'close';

export const UIIcon: FC<{
  iconName: IconName;
  className?: string;
  /**
   * Alternative: Pass a Hugeicons icon name directly (e.g., 'Lock01Icon', 'Star01Icon')
   * This allows using any icon from @hugeicons/core-free-icons without pre-mapping
   */
  hugeIconName?: string;
}> = ({ iconName, className, hugeIconName }) => {
  // If hugeIconName is provided, try to load it dynamically
  let iconElement: IconSvgElement | null = null;

  if (hugeIconName) {
    try {
      // Dynamic import support for any Hugeicons icon
      const icons = require('@hugeicons/core-free-icons');
      iconElement = icons[hugeIconName] || null;
    } catch {
      // Fall back to iconName mapping
      iconElement = null;
    }
  }

  const icon = iconElement || getIconByName(iconName);
  return <HugeiconsIcon icon={icon} className={className} />;
};

function getIconByName(iconName: IconName): IconSvgElement {
  switch (iconName) {
    case 'loading':
      return Loading03Icon;
    case 'info-circle':
      return InformationCircleIcon;
    case 'pdf':
      return Pdf02Icon;
    case 'xlsx':
      return Xls02Icon;
    case 'arrow-right':
      return ArrowRight02Icon;
    case 'check':
      return CheckmarkCircle02Icon;
    case 'alert-circle':
      return AlertCircleIcon;
    case 'clipboard':
      return ClipboardIcon;
    case 'check-circle':
      return CheckmarkCircle02Icon;
    case 'note-add':
      return NoteAddIcon;
    case 'fingerprint':
      return FingerPrintScanIcon;
    case 'airplane':
      return Airplane01Icon;
    case 'import':
      return Upload01Icon;
    case 'export':
      return Download01Icon;
    case 'user':
      return Happy01Icon;
    case 'logout':
      return Logout01Icon;
    case 'coffee':
      return Coffee01Icon;
    case 'hand-right':
      return HandPointingRight01Icon;
    case 'alert':
      return AlertCircleIcon;
    case 'target':
      return Target01Icon;
    case 'trash':
      return Delete02Icon;
    case 'history':
      return TransactionHistoryIcon;
    case 'circle-x':
      return MultiplicationSignIcon;
    case 'x':
      return X;
    case 'passport':
      return Passport01Icon;
    case 'arrow-left':
      return ArrowLeft02Icon;
    case 'arrow-up':
      return ArrowUp02Icon;
    case 'arrow-down':
      return ArrowDown02Icon;
    case 'calendar':
      return Calendar01Icon;
    case 'pencil':
      return PencilEdit01Icon;
    case 'circle':
      return CircleIcon;
    case 'plus':
      return PlusSignIcon;
    case 'drag-drop':
      return DragDropVerticalIcon;
    case 'alert-triangle':
      return AlertTriangle;
    case 'menu':
      return Menu01Icon;
    case 'close':
      return Cancel01Icon;
    default:
      throw new NeverError(iconName);
  }
}
