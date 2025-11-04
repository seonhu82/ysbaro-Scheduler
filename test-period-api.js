// Test script to verify slot calculation logic

function calculateTotalSlots(year, month, maxSlotsPerDay = 3) {
  const startOfMonth = new Date(year, month - 1, 1)
  const endOfMonth = new Date(year, month, 0)

  let workingDays = 0
  for (let date = new Date(startOfMonth); date <= endOfMonth; date.setDate(date.getDate() + 1)) {
    // Count weekdays (excluding Sundays)
    if (date.getDay() !== 0) {
      workingDays++
    }
  }

  return {
    workingDays,
    maxSlotsPerDay,
    totalSlots: workingDays * maxSlotsPerDay
  }
}

// Test for November 2025
const nov2025 = calculateTotalSlots(2025, 11, 3)
console.log(`November 2025: ${nov2025.workingDays}일 × ${nov2025.maxSlotsPerDay}명 = ${nov2025.totalSlots} 슬롯`)

// Test for October 2025
const oct2025 = calculateTotalSlots(2025, 10, 3)
console.log(`October 2025: ${oct2025.workingDays}일 × ${oct2025.maxSlotsPerDay}명 = ${oct2025.totalSlots} 슬롯`)

// Test for September 2025
const sep2025 = calculateTotalSlots(2025, 9, 3)
console.log(`September 2025: ${sep2025.workingDays}일 × ${sep2025.maxSlotsPerDay}명 = ${sep2025.totalSlots} 슬롯`)
