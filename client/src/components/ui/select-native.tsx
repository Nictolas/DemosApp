import * as React from "react"
import { cn } from "@/lib/utils"

// Select nativo HTML che funziona sempre su mobile
export function SelectNative({
  value,
  onValueChange,
  children,
  className,
  placeholder = "Seleziona...",
  disabled = false,
  ...props
}: {
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
  placeholder?: string
  disabled?: boolean
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (onValueChange) {
      onValueChange(event.target.value)
    }
  }

  return (
    <select
      value={value || ""}
      onChange={handleChange}
      disabled={disabled}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-white text-black px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      style={{
        backgroundColor: 'white',
        color: 'black',
        border: '1px solid #d1d5db',
        position: 'relative',
        zIndex: 1,
        // Stili specifici per mobile
        WebkitAppearance: 'none',
        MozAppearance: 'none',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.7em top 50%',
        backgroundSize: '1em auto',
        paddingRight: '2.5em'
      }}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {children}
    </select>
  )
}

// Componente SelectItem per il Select nativo
function SelectItem({
  value,
  children,
  className,
  disabled = false,
  ...props
}: {
  value: string
  children: React.ReactNode
  className?: string
  disabled?: boolean
} & React.OptionHTMLAttributes<HTMLOptionElement>) {
  
  return (
    <option
      value={value}
      disabled={disabled}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-xs py-1.5 pl-8 pr-2 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      style={{
        backgroundColor: 'white',
        color: 'black',
        padding: '8px 12px'
      }}
      {...props}
    >
      {children}
    </option>
  )
}

// Componente SelectGroup per il Select nativo
function SelectGroup({
  children,
  className,
  ...props
}: {
  children: React.ReactNode
  className?: string
} & React.OptgroupHTMLAttributes<HTMLOptGroupElement>) {
  
  return (
    <optgroup
      className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
      style={{
        backgroundColor: '#f8f9fa',
        color: '#495057',
        fontWeight: 'bold'
      }}
      {...props}
    >
      {children}
    </optgroup>
  )
}

// Componente SelectValue per il Select nativo
function SelectValue({
  placeholder,
  children
}: {
  placeholder?: string
  children?: React.ReactNode
}) {
  return children || placeholder || "Seleziona..."
}

// Componente SelectTrigger per il Select nativo (compatibilità)
function SelectTrigger({
  children,
  className,
  ...props
}: {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  
  return (
    <div
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        className
      )}
      style={{
        backgroundColor: 'white',
        color: 'black',
        border: '1px solid #d1d5db'
      }}
      {...props}
    >
      {children}
    </div>
  )
}

// Componente SelectContent per il Select nativo (compatibilità)
function SelectContent({
  children,
  className,
  ...props
}: {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  
  return (
    <div
      className={cn(
        "relative z-50 max-h-96 min-w-32 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
        className
      )}
      style={{
        backgroundColor: 'white',
        color: 'black',
        border: '1px solid #d1d5db',
        zIndex: 99999
      }}
      {...props}
    >
      {children}
    </div>
  )
}

// Componente SelectLabel per il Select nativo (compatibilità)
function SelectLabel({
  children,
  className,
  ...props
}: {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  
  return (
    <div
      className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
      style={{
        backgroundColor: '#f8f9fa',
        color: '#495057',
        fontWeight: 'bold'
      }}
      {...props}
    >
      {children}
    </div>
  )
}

// Componente SelectSeparator per il Select nativo (compatibilità)
function SelectSeparator({
  className,
  ...props
}: {
  className?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  
  return (
    <div
      className={cn("-mx-1 my-1 h-px bg-muted", className)}
      style={{
        backgroundColor: '#dee2e6',
        height: '1px',
        margin: '4px -4px'
      }}
      {...props}
    />
  )
}

// Esporta tutti i componenti per compatibilità
export {
  SelectNative as Select,
  SelectItem,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectSeparator
}
