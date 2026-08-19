import React from 'react';
import { Switch, type SwitchProps } from '@heroui/react';

export const ThemeSwitch = React.forwardRef<HTMLDivElement, SwitchProps>((props, ref) => {
    return (
        <Switch {...props} ref={ref}>
            <Switch.Content>
                <Switch.Control>
                    <Switch.Thumb />
                </Switch.Control>
            </Switch.Content>
        </Switch>
    );
});

ThemeSwitch.displayName = 'ThemeSwitch';
