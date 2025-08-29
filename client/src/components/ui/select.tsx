import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

// Componente Select semplificato senza Radix UI
const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & {
    children: React.ReactNode
  }
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-white text-black px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
  </select>
))
Select.displayName = "Select"

// Componente SelectTrigger semplificato
const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode
    onValueChange?: (value: string) => void
    value?: string
  }
>(({ className, children, onValueChange, value, ...props }, ref) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const [selectedValue, setSelectedValue] = React.useState(value || "")
  const [options, setOptions] = React.useState<React.ReactNode[]>([])

  // Estrae le opzioni dai children
  React.useEffect(() => {
    if (children && typeof children === 'object' && 'type' === 'object') {
      const selectContent = children as any
      if (selectContent.props && selectContent.props.children) {
        setOptions(React.Children.toArray(selectContent.props.children))
      }
    }
  }, [children])

  const handleSelect = (optionValue: string) => {
    setSelectedValue(optionValue)
    setIsOpen(false)
    onValueChange?.(optionValue)
  }

  return (
    <div className="relative">
      <button
        ref={ref}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-white text-black px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        <span className="truncate">
          {selectedValue || "Seleziona..."}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {options.map((option, index) => {
            if (React.isValidElement(option) && option.type === SelectItem) {
              const optionValue = option.props.value
              const optionText = option.props.children
              return (
                <button
                  key={index}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-black hover:bg-gray-100 focus:bg-blue-50 focus:outline-none"
                  onClick={() => handleSelect(optionValue)}
                >
                  {optionText}
                </button>
              )
            }
            return null
          })}
        </div>
      )}
    </div>
  )
})
SelectTrigger.displayName = "SelectTrigger"

// Componenti di supporto semplificati
const SelectContent = ({ children }: { children: React.ReactNode }) => <>{children}</>
const SelectItem = ({ value, children }: { value: string; children: React.ReactNode }) => <>{children}</>
const SelectValue = ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>
const SelectGroup = ({ children }: { children: React.ReactNode }) => <>{children}</>
const SelectLabel = ({ children }: { children: React.ReactNode }) => <>{children}</>
const SelectSeparator = () => <hr className="my-1" />
const SelectScrollUpButton = () => null
const SelectScrollDownButton = () => null

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
