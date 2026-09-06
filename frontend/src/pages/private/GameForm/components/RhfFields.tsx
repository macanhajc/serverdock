import { ComponentProps } from 'react';
import { Controller, type Control } from 'react-hook-form';
import { TextField } from '../../../../components/forms/TextField';
import { SegmentedControl } from '../../../../components/forms/SegmentedControl';
import { Toggle } from '../../../../components/core/Toggle';
import { DockerfileField } from './DockerfileField';
import type { GameFormValues } from '../formSchema';

// Every string-valued field in the form — the only ones RhfTextField/
// RhfSegmentedControl/RhfDockerfileField are allowed to bind to.
type StringField = {
  [K in keyof GameFormValues]: GameFormValues[K] extends string ? K : never;
}[keyof GameFormValues];

// Thin Controller adapters over the shared design-system inputs. None of
// TextField/SegmentedControl/Toggle forward a ref, so react-hook-form's
// register() can't attach to them directly — Controller drives them off
// field.value/onChange instead, with zero changes to those shared components.

export function RhfTextField({
  control,
  name,
  ...props
}: {
  control: Control<GameFormValues>;
  name: StringField;
} & Omit<ComponentProps<typeof TextField>, 'value' | 'onChange' | 'onBlur' | 'name'>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <TextField
          {...props}
          name={field.name}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
        />
      )}
    />
  );
}

export function RhfSegmentedControl({
  control,
  name,
  ...props
}: {
  control: Control<GameFormValues>;
  name: StringField;
} & Omit<ComponentProps<typeof SegmentedControl>, 'value' | 'onChange'>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <SegmentedControl {...props} value={field.value} onChange={field.onChange} />
      )}
    />
  );
}

export function RhfToggle({
  control,
  ...props
}: {
  control: Control<GameFormValues>;
} & Omit<ComponentProps<typeof Toggle>, 'checked' | 'onChange'>) {
  return (
    <Controller
      control={control}
      name="rconEnabled"
      render={({ field }) => (
        <Toggle {...props} checked={!!field.value} onChange={field.onChange} />
      )}
    />
  );
}

export function RhfDockerfileField({
  control,
  ...props
}: {
  control: Control<GameFormValues>;
} & Omit<ComponentProps<typeof DockerfileField>, 'value' | 'onChange'>) {
  return (
    <Controller
      control={control}
      name="dockerfile"
      render={({ field }) => (
        <DockerfileField {...props} value={field.value} onChange={field.onChange} />
      )}
    />
  );
}
