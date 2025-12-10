export const InfoSection = () => {
  return (
    <div className="mt-4 sm:mt-6 text-center text-xs text-muted-foreground space-y-1">
      <p>
        <strong>Calculation:</strong> Full days = (Return − Departure) − 1,
        excluding both travel days.
      </p>
      <p>
        Works with UK Home Office Subject Access Request (SAR) documents.
      </p>
    </div>
  );
};
