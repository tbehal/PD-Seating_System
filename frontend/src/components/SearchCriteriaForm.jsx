import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { searchCriteriaSchema } from '../schemas/search';
import { useScheduleStore } from '../stores/scheduleStore';

export default function SearchCriteriaForm({ onSearch, isLoading }) {
  const { searchCriteria, setSearchCriteria } = useScheduleStore();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(searchCriteriaSchema),
    defaultValues: searchCriteria,
  });

  const watchedValues = watch();

  useEffect(() => {
    const parsed = {
      startWeek: Number(watchedValues.startWeek),
      endWeek: Number(watchedValues.endWeek),
      weeksNeeded: Number(watchedValues.weeksNeeded),
    };
    if (
      parsed.startWeek !== searchCriteria.startWeek ||
      parsed.endWeek !== searchCriteria.endWeek ||
      parsed.weeksNeeded !== searchCriteria.weeksNeeded
    ) {
      setSearchCriteria(parsed);
    }
  }, [
    watchedValues.startWeek,
    watchedValues.endWeek,
    watchedValues.weeksNeeded,
    searchCriteria,
    setSearchCriteria,
  ]);

  const onSubmit = () => {
    onSearch();
  };

  const startWeek = Number(watchedValues.startWeek);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="startWeek" className="block text-sm font-medium text-gray-700">
          Start Week
        </label>
        <select
          id="startWeek"
          {...register('startWeek', { valueAsNumber: true })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((week) => (
            <option key={`start-${week}`} value={week}>
              {week}
            </option>
          ))}
        </select>
        {errors.startWeek && (
          <p className="mt-1 text-sm text-red-600">{errors.startWeek.message}</p>
        )}
      </div>
      <div>
        <label htmlFor="endWeek" className="block text-sm font-medium text-gray-700">
          End Week
        </label>
        <select
          id="endWeek"
          {...register('endWeek', { valueAsNumber: true })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((week) => (
            <option key={`end-${week}`} value={week} disabled={week < startWeek}>
              {week} {week < startWeek ? '(Invalid)' : ''}
            </option>
          ))}
        </select>
        {errors.endWeek && <p className="mt-1 text-sm text-red-600">{errors.endWeek.message}</p>}
      </div>
      <div>
        <label htmlFor="weeksNeeded" className="block text-sm font-medium text-gray-700">
          Consecutive Weeks Needed
        </label>
        <input
          type="number"
          id="weeksNeeded"
          {...register('weeksNeeded', { valueAsNumber: true })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
          min="1"
        />
        {errors.weeksNeeded && (
          <p className="mt-1 text-sm text-red-600">{errors.weeksNeeded.message}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:bg-gray-400"
      >
        {isLoading ? 'Searching...' : 'Find Availability'}
      </button>
    </form>
  );
}
