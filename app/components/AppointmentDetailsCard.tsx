import React from 'react';

const AppointmentDetailsCard = ({ appointment }) => {
  if (!appointment || Object.keys(appointment).length === 0) {
    return null;
  }

  // Check if there's a confirmed appointment
  const isConfirmed = appointment.status === "Confirmed";
  const hasPaymentLink = appointment.paymentLink && appointment.paymentLink.trim() !== '';

  return (
    <div className="mt-4">
      <h3 className="text-red-500 font-medium mb-2">
        {isConfirmed ? "Confirmed Appointment" : "Scheduled Consultation"}
      </h3>
      <div className="bg-red-50 p-3 rounded">
        <div className="text-gray-600 space-y-2">
          {appointment.doctor && (
            <div>
              <span className="font-medium">Doctor: </span>
              {appointment.doctor}
            </div>
          )}
          <div>
            <span className="font-medium">Date: </span>
            {appointment.date === "TBD"
              ? "To be decided"
              : new Date(appointment.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
          </div>
          <div>
            <span className="font-medium">Time: </span>
            {appointment.time === "TBD"
              ? "To be decided"
              : appointment.time && appointment.time.includes(":")
                ? appointment.time
                : "Time to be confirmed"}
          </div>
          <div>
            <span className="font-medium">Type: </span>
            {appointment.consultationType || appointment.type || "Not specified"}
          </div>
          {appointment.center && (
            <div>
              <span className="font-medium">Center: </span>
              {appointment.center}
            </div>
          )}
          {appointment.city && (
            <div>
              <span className="font-medium">City: </span>
              {appointment.city}
            </div>
          )}
          {hasPaymentLink && (
            <div className="mt-3">
              <span className="font-medium text-red-600">Payment Link: </span>
              <a 
                href={appointment.paymentLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                Make Payment
              </a>
            </div>
          )}
          {appointment.bookingId && (
            <div className="mt-2">
              <span className="font-medium">Booking ID: </span>
              {appointment.bookingId}
            </div>
          )}
          {isConfirmed && (
            <div className="mt-2 text-sm text-green-600">
              <svg
                className="inline-block w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Appointment confirmed
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppointmentDetailsCard;