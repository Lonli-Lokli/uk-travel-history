# @uth/ui

shadcn/ui component library with Radix UI primitives.

## Purpose

Shared UI component library based on shadcn/ui design system with Tailwind CSS styling.

## Components

### Layout

- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
- `Drawer`, `DrawerContent`, `DrawerTitle`, `DrawerDescription`
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
- `Sheet`, `SheetContent`, `SheetHeader`

### Navigation

- `NavigationMenu`, `NavigationMenuList`, `NavigationMenuItem`, `NavigationMenuLink`

### Forms

- `Button`, `Input`, `Label`, `Textarea`
- `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`
- `Checkbox`, `RadioGroup`
- `DatePicker` (custom with react-day-picker)

### Data Display

- `Table`, `TableHeader`, `TableRow`, `TableCell`
- `Badge`, `Avatar`, `Tooltip`
- `Skeleton` (loading states)

### Feedback

- `Alert`, `AlertDescription`
- `Toast`, `Toaster` (react-hot-toast)
- `Progress`

### Overlays

- `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`
- `Popover`, `PopoverTrigger`, `PopoverContent`
- `HoverCard`

### Icons

- `UIIcon` - Custom icon component with Lucide icons

## Usage

```typescript
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Dialog,
  DialogContent,
} from '@uth/ui';

function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
      </CardHeader>
      <CardContent>
        <Button>Click me</Button>
      </CardContent>
    </Card>
  );
}
```

## Styling

All components use Tailwind CSS with CSS variables for theming:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  /* ... */
}
```

## Customization

Components support `className` prop for custom styling:

```typescript
<Button className="bg-red-500 hover:bg-red-600">
  Custom Button
</Button>
```

## Testing

```bash
nx test ui
```

## Dependencies

- `@radix-ui/*` - Headless UI primitives
- `class-variance-authority` - Variant styling
- `tailwind-merge` - className merging
- `lucide-react` - Icon library
- `react-day-picker` - Date picker
- `react-hot-toast` - Toast notifications

## Related

- **[shadcn/ui](https://ui.shadcn.com/)** - Official documentation
- **[Radix UI](https://www.radix-ui.com/)** - Primitive components
