import React, { useState, useEffect } from 'react';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const DatePicker: React.FC<DatePickerProps> = ({ 
  value, 
  onChange, 
  disabled = false, 
  placeholder = "Seleziona data" 
}) => {
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');

  // Inizializza i valori dal value prop
  useEffect(() => {
    if (value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        setDay(date.getDate().toString().padStart(2, '0'));
        setMonth((date.getMonth() + 1).toString().padStart(2, '0'));
        setYear(date.getFullYear().toString());
      }
    }
  }, [value]);

  // Aggiorna il valore quando cambiano i campi
  useEffect(() => {
    if (day && month && year) {
      const dateString = `${year}-${month}-${day}`;
      onChange(dateString);
    }
  }, [day, month, year, onChange]);

  const generateDays = () => {
    if (!month || !year) return [];
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString().padStart(2, '0'));
  };

  const months = [
    { value: '01', label: 'Gennaio' },
    { value: '02', label: 'Febbraio' },
    { value: '03', label: 'Marzo' },
    { value: '04', label: 'Aprile' },
    { value: '05', label: 'Maggio' },
    { value: '06', label: 'Giugno' },
    { value: '07', label: 'Luglio' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Settembre' },
    { value: '10', label: 'Ottobre' },
    { value: '11', label: 'Novembre' },
    { value: '12', label: 'Dicembre' }
  ];

  const years = Array.from({ length: 100 }, (_, i) => (new Date().getFullYear() - 50 + i).toString());

  const days = generateDays();

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Giorno */}
      <div>
        <select
          value={day}
          onChange={(e) => setDay(e.target.value)}
          disabled={disabled}
          className="w-full h-12 text-lg text-center border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">Giorno</option>
          {days.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {/* Mese */}
      <div>
        <select
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            setDay(''); // Reset giorno quando cambia mese
          }}
          disabled={disabled}
          className="w-full h-12 text-lg text-center border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">Mese</option>
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Anno */}
      <div>
        <select
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
            setDay(''); // Reset giorno quando cambia anno
          }}
          disabled={disabled}
          className="w-full h-12 text-lg text-center border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">Anno</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default DatePicker;
