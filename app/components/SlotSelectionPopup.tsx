import React from 'react';

const SlotSelectionPopup = ({ 
  isOpen, 
  slots, 
  day, 
  location, 
  onSelect, 
  onClose 
}) => {
  if (!isOpen || !slots || slots.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            Available Slots {location ? `at ${location}` : ''}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <p className="mb-4">Please select a time slot for {day}:</p>
        
        <div className="max-h-60 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            {slots.map((slot, index) => (
              <button
                key={index}
                onClick={() => onSelect(slot)}
                className="p-2 border border-gray-300 rounded hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
              >
                {slot}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlotSelectionPopup;