import React, { useState } from 'react';

export const TestInput = () => {
  const [value, setValue] = useState("");
  
  console.log('🔄 TestInput render - value:', value);
  
  return (
    <div className="mb-4 p-4 border border-blue-500 bg-blue-50">
      <label className="block text-sm font-medium mb-2">INPUT MANUALE (test):</label>
      <input 
        type="text" 
        value={value}
        onChange={(e) => {
          console.log('📝 TestInput onChange:', e.target.value);
          setValue(e.target.value);
        }}
        placeholder="Digita qui per testare input manuale..."
        className="w-full p-2 border border-gray-300 rounded"
      />
      <p className="text-sm text-gray-600 mt-1">Valore: {value}</p>
    </div>
  );
};
