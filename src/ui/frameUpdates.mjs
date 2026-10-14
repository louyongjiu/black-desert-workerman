export function frameUpdates(
  update,
  request = requestAnimationFrame,
  cancel = cancelAnimationFrame
) {
  let frame = null;
  const schedule = () => {
    if (frame !== null) return;
    frame = request(() => {
      frame = null;
      update();
    });
  };
  schedule.cancel = () => {
    if (frame !== null) cancel(frame);
    frame = null;
  };
  return schedule;
}
